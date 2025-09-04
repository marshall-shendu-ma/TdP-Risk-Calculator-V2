document.addEventListener('DOMContentLoaded', function() {
  try { if (window.ChartAnnotation) { Chart.register(window.ChartAnnotation); } } catch (e) {}

  let hillChart = null;
  let modelChart = null;
  let Prob1 = 0;
  let cmaxIsNM = false;
  let blockModelRender = false;

  // Collapse toggles (safe binds)
  const cmaxHeader = document.getElementById('cmaxSectionHeader');
  const cmaxContent = document.getElementById('cmaxSectionContent');
  if (cmaxHeader && cmaxContent) {
    cmaxHeader.addEventListener('click', () => {
      const open = cmaxContent.style.display !== 'none';
      cmaxContent.style.display = open ? 'none' : '';
      cmaxHeader.textContent = (open ? '▸' : '▾') + ' Cmax Interpolation';
    });
  }

  const hillHeader = document.getElementById('hillSectionHeader');
  const hillContent = document.getElementById('hillSectionContent');
  if (hillHeader && hillContent) {
    hillHeader.addEventListener('click', () => {
      const open = hillContent.style.display !== 'none';
      hillContent.style.display = open ? 'none' : '';
      hillHeader.textContent = (open ? '▸' : '▾') + ' Hill Fit Curve (only available when input is filled in Cmax Interpolation)';
    });
  }

  // Optional QT collapsible (if present)
  const qtHeader = document.getElementById('qtSectionHeader');
  const qtContent = document.getElementById('qtSectionContent');
  if (qtHeader && qtContent) {
    qtHeader.addEventListener('click', () => {
      const open = qtContent.style.display !== 'none';
      qtContent.style.display = open ? 'none' : '';
      qtHeader.textContent = (open ? '▸' : '▾') + ' QT Prolongation Prediction (in progress)';
    });
  }

  // Unit switch (safe bind)
  const switchBtn = document.getElementById('switchCmaxUnit');
  if (switchBtn) {
    switchBtn.addEventListener('click', () => {
      const inp = document.getElementById('cmax');
      const lbl = document.getElementById('cmaxLabel');
      if (!inp || !lbl) return;
      let v = parseFloat(inp.value);
      if (isNaN(v)) return;
      if (cmaxIsNM) {
        v /= 1000;
        lbl.innerHTML = 'Cmax (<span class="plain-greek">µ</span>M)';
        const ch = document.getElementById('concHeader');
        if (ch) ch.innerHTML = 'Concentration (<span class="plain-greek">µ</span>M)';
      } else {
        v *= 1000;
        lbl.innerText = 'Cmax (nM)';
        const ch = document.getElementById('concHeader');
        if (ch) ch.innerText = 'Concentration (nM)';
      }
      inp.value = v.toFixed(4);
      cmaxIsNM = !cmaxIsNM;
    });
  }

  // Row helpers
  window.addRow = () => {
    const tb = document.getElementById('dataBody');
    if (!tb) return;
    const r = document.createElement('tr');
    r.innerHTML = '<td><input name="concentration[]" type="number" step="any" required></td>' +
                  '<td><input name="fpdc[]" type="number" step="any" required></td>' +
                  '<td><button type="button" onclick="removeRow(this)">−</button></td>';
    tb.appendChild(r);
  };
  window.removeRow = (btn) => { const tr = btn && btn.closest ? btn.closest('tr') : null; if (tr) tr.remove(); };

  // Event bindings
  const predictorBtn = document.getElementById('predictorCalcBtn');
  if (predictorBtn) predictorBtn.addEventListener('click', () => calculate(true));
  const riskForm = document.getElementById('riskForm');
  if (riskForm) riskForm.addEventListener('submit', (e) => { e.preventDefault(); calculate(false); });

  function calculate(predOnly) {
    blockModelRender = false;
    let hadError = false;

    let arr, p4, p7, cell = 0, assay = '30', Cmax, concs = [], fpdcs = [];

    if (predOnly) {
      arr = parseInt(document.getElementById('predictor1').value);
      p4 = parseFloat(document.getElementById('predictor4').value);
      p7 = parseFloat(document.getElementById('predictor7').value);
      if (isNaN(arr) || isNaN(p4) || isNaN(p7)) { alert('Fill predictors'); return; }
      const c = document.getElementById('cmax'); if (c) c.value = '';
      document.querySelectorAll('#dataBody input').forEach(el => el.value = '');
      if (p4 === 0 && p7 === 0) { alert('No drug-induced repolarization changes based on your Predictor Inputs. TdP risk cannot be justified.'); }
    } else {
      Cmax = parseFloat(document.getElementById('cmax').value);
      if (cmaxIsNM) Cmax /= 1000;
      arr = parseInt(document.getElementById('arrhythmia').value);
      const cellEl = document.getElementById('celltype'); cell = cellEl ? parseFloat(cellEl.value) : 0;

      document.querySelectorAll('#dataBody tr').forEach(r => {
        const inputs = r.querySelectorAll('input');
        const ci = inputs[0], fi = inputs[1];
        const c = parseFloat(ci.value), f = parseFloat(fi.value);
        if (!isNaN(c) && !isNaN(f)) { concs.push(c); fpdcs.push(f); }
      });

      if (!isNaN(Cmax) && concs.length) {
        const minConc = Math.min(...concs);
        const maxConc = Math.max(...concs);
        if (Cmax < minConc || Cmax > maxConc) { alert("Cmax is outside of the concentration range in your input.\nTdP Risk cannot be calculated."); return; }
      }
      if (concs.length < 3) { alert('Enter ≥3 points'); return; }
      p4 = Math.max(...fpdcs);

      // Hill fit (Hill fixed at 1), allow positive/negative trends
      const minY = Math.min(...fpdcs), maxY = Math.max(...fpdcs);
      const meanX = concs.reduce((a,b)=>a+b,0)/concs.length;
      const meanY = fpdcs.reduce((a,b)=>a+b,0)/fpdcs.length;
      const slope = concs.map((x,i)=>(x-meanX)*(fpdcs[i]-meanY)).reduce((a,b)=>a+b,0) /
                    concs.map(x=>(x-meanX)*(x-meanX)).reduce((a,b)=>a+b,1e-9);
      const decreasing = slope < 0;
      const Bottom = decreasing ? maxY : minY;
      const Top    = decreasing ? minY : maxY;

      const median = a => { const s=[...a].sort((x,y)=>x-y), m=Math.floor(s.length/2); return a.length%2 ? s[m] : (s[m-1]+s[m])/2; };
      let best = { Bottom, Top, EC50: median(concs), Hill: 1 };
      const hillf = (x,p) => p.Bottom + (p.Top - p.Bottom) / (1 + (p.EC50 / x));

      const loss = p => fpdcs.reduce((s,y,i)=> s + Math.pow(hillf(concs[i],p) - y, 2), 0);
      let minE = Infinity;
      const lo = Math.min(...concs), hi = Math.max(...concs);
      const step = (hi - lo) / 100;
      for (let ec = Math.max(1e-6, lo*0.1); ec <= hi*10; ec += Math.max(step, 1e-6)) {
        const t = { ...best, EC50: ec };
        const e = loss(t);
        if (e < minE) { minE = e; best = t; }
      }

      const FPDc = hillf(!isNaN(Cmax) ? Cmax : lo, best);
      p7 = FPDc;
      document.getElementById('predictor1').value = String(arr);
      document.getElementById('predictor4').value = isFinite(p4) ? Number(p4).toFixed(4) : '';
      document.getElementById('predictor7').value = isFinite(p7) ? Number(p7).toFixed(4) : '';

      if (p4 === 0 && p7 === 0) { alert('No drug-induced repolarization changes based on your Predictor Inputs. TdP risk cannot be justified.'); }

      const Thr = assay === '30' ? Bottom*1.103 : Bottom*1.0794;
      const logM = assay === '30' ? (Thr+0.35)/0.92 : (Thr+0.17)/0.93;
      const qtEl = document.getElementById('estimatedQTc');
      if (qtEl) {
        qtEl.innerHTML = `<strong>QTc (log M):</strong> ${logM.toFixed(4)}<br><strong>Conc >10ms QT:</strong> ${Math.pow(10,logM).toFixed(4)} µM`;
      }

      // Render Hill plot
      const fitX = Array.from({length:100},(_,i)=> Math.pow(10, Math.log10(Math.max(0.001, lo)) + i*(Math.log10(hi)-Math.log10(Math.max(0.001, lo)))/99));
      const fitY = fitX.map(x => hillf(x, best));
      if (hillChart) hillChart.destroy();
      hillChart = new Chart(document.getElementById('hillPlot'), {
        type:'line',
        data:{ datasets:[
          { label:'Hill Fit', type:'line', data: fitX.map((x,i)=>({x:x, y:fitY[i]})), borderWidth:3, fill:false, parsing:false },
          { label:'Data', type:'scatter', data: concs.map((x,i)=>({x:x, y:fpdcs[i]})), pointRadius:4, parsing:false },
          { label:'Cmax', type:'scatter', data: !isNaN(Cmax) ? [{x:Cmax, y:FPDc}] : [], pointRadius:6, parsing:false }
        ]},
        options:{
          scales:{
            x:{ type:'logarithmic', grid:{lineWidth:5}, ticks:{font:{size:20}}, title:{display:true, text:'Concentration (µM)', font:{size:18}}},
            y:{ grid:{lineWidth:5}, ticks:{font:{size:20}}, title:{display:true, text:'ΔΔFPDc or ΔΔAPD90c (ms)', font:{size:18}}}
          },
          plugins:{ legend:{display:false} }
        }
      });
    }

    // Model 1 logistic
    const map1 = [0,0.6583,1.7944];
    const logit1 = -0.1311 + map1[arr] + 0.00687*p4 + 0.0232*p7;
    Prob1 = 1/(1+Math.exp(-logit1));
    if (Prob1 < 0) { alert('Model 1 returned a negative risk probability result and is not applicable for your Predictor Inputs.'); hadError=true; }

    if (hadError && predOnly) { clearModelChart(); return; }
    updateModelPanel();
  }

  function clearModelChart() {
    const res = document.getElementById('modelResults');
    const sub = document.getElementById('modelSubtitle');
    if (modelChart) { modelChart.destroy(); modelChart = null; }
    if (res) res.innerHTML = '';
    if (sub) sub.innerHTML = '';
  }

  function updateModelPanel() {
    if (blockModelRender) { clearModelChart(); return; }
    const title = document.getElementById('modelTitle');
    const sub = document.getElementById('modelSubtitle');
    const res = document.getElementById('modelResults');
    const labels = ['High or Intermediate TdP Risk Probability','Low TdP Risk Probability'];
    const data = [Prob1*100, (1-Prob1)*100];
    const colors = labels.map(l => l.includes('High') ? 'rgb(230,75,53)' : 'rgb(3,160,135)');
    if (title) title.innerText = 'Model 1 TdP Risk';
    if (sub) sub.innerHTML = 'This model uses logistic regression.<br>The model outputs are:';
    if (res) res.innerHTML = '<ul style="margin-left:20px;">' + labels.map((l,i)=>`<li><strong>${l}:</strong> ${data[i].toFixed(1)}%</li>`).join('') + '</ul>';

    if (modelChart) modelChart.destroy();
    const ctx = document.getElementById('modelChart');
    if (!ctx) return;
    const baseOpts = {
      scales:{
        x:{ grid:{lineWidth:5}, ticks:{font:{size:20}} },
        y:{ beginAtZero:true, max:100, grid:{lineWidth:5}, ticks:{font:{size:20}}, title:{display:true, text:'Predicted Risk Probability', font:{size:18}} }
      },
      plugins:{ legend:{display:false} }
    };
    // add threshold line using annotation plugin if available
    if (window.ChartAnnotation) {
      baseOpts.plugins.annotation = {
        annotations:{
          riskThreshold:{
            type:'line', yMin:80, yMax:80,
            borderColor:'red', borderWidth:5, borderDash:[6,6],
            label:{ display:true, content:'Risk Probability Threshold', position:'end', color:'red', font:{size:16, weight:'bold'}, yAdjust:-8 }
          }
        }
      };
    }
    modelChart = new Chart(ctx, {
      type:'bar',
      data:{ labels, datasets:[{ label:'% Risk', data, backgroundColor:colors }] },
      options: baseOpts
    });
  }
});