window.onload = function() {
  let hillChart, modelChart, isModel1 = true;
  let Prob1, Prob2a, Prob2b;
  let cmaxIsNM = true;

  // Toggle Cmax unit
  document.getElementById("switchCmaxUnit").addEventListener("click", () => {
    const inp = document.getElementById("cmax"), lbl = document.getElementById("cmaxLabel");
    let v = parseFloat(inp.value);
    if(isNaN(v)) return;
    if(cmaxIsNM) { v/=1000; lbl.innerText="Cmax (µM)"; }
    else { v*=1000; lbl.innerText="Cmax (nM)"; }
    inp.value=v.toFixed(4);
    cmaxIsNM = !cmaxIsNM;

  window.addRow = function() {
    const tb = document.getElementById("dataBody");
    const r = document.createElement("tr");
    r.innerHTML = '<td><input type="number" step="any" required name="concentration[]"></td>'
                + '<td><input type="number" step="any" required name="fpdc[]"></td>'
                + '<td><button type="button" onclick="removeRow(this)">−</button></td>';
    tb.appendChild(r);
  };
  window.removeRow = btn => btn.closest("tr").remove();

  const median = arr => {
    const s=[...arr].sort((a,b)=>a-b), m=Math.floor(s.length/2);
    return s.length%2? s[m]: (s[m-1]+s[m])/2;
  };

  const updateModelPanel = () => {
    const title = document.getElementById("modelTitle"),
          sub = document.getElementById("modelSubtitle"),
          res = document.getElementById("modelResults");
    let labels, data, lbl;
    if(isModel1) {
      title.innerText="Model 1 TdP Risk (Logistic Regression)";
      sub.innerText="Logistic regression predicting high or low risk.";
      res.innerHTML=`<p><strong>High or Intermediate Risk:</strong> ${(Prob1*100).toFixed(1)}%</p>
                     <p><strong>Low Risk:</strong> ${((1-Prob1)*100).toFixed(1)}%</p>`;
      labels=["High/Intermediate Risk","Low Risk"];
      data=[Prob1*100,(1-Prob1)*100];
      lbl="% TdP Risk (Model 1)";
    } else {
      title.innerText="Model 2 TdP Risk (Ordinal Regression)";
      sub.innerText="Ordinal regression predicting high, intermediate, and low risk.";
      res.innerHTML=`<p><strong>High Risk:</strong> ${(Prob2a*100).toFixed(1)}%</p>
                     <p><strong>Intermediate Risk:</strong> ${(Prob2b*100).toFixed(1)}%</p>
                     <p><strong>Low Risk:</strong> ${((1-Prob2a-Prob2b)*100).toFixed(1)}%</p>`;
      labels=["High","Intermediate","Low"];
      data=[Prob2a*100,Prob2b*100,(1-Prob2a-Prob2b)*100];
      lbl="% TdP Risk (Model 2)";
    }
    if(modelChart) modelChart.destroy();
    
    if (modelChart) modelChart.destroy();
    modelChart = new Chart(document.getElementById("modelChart"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Hill Fit Curve",
            data: fitX.map((x,i) => ({ x, y: fitY[i] })),
            borderColor: "#2c7be5",
            borderWidth: 3,
            fill: false,
            tension: 0.1,
            type: "line"
          },
          {
            label: "Cmax Line",
            data: [{ x: Cmax, y: 0 }, { x: Cmax, y: Math.max(...fpdcs) }],
            borderColor: "#d9534f",
            borderWidth: 3,
            borderDash: [5,5],
            fill: false,
            showLine: true,
            pointRadius: 0,
            type: "line"
          },
          {
            label: "Input Data",
            data: concentrations.map((c,i) => ({ x: c, y: fpdcs[i] })),
            pointBackgroundColor: "#333",
            pointRadius: 5,
            type: "scatter"
          }
        ], options: {
        scales: {
          x: {
            ticks: { font: { size: 16, weight: "bold" } },
            grid: { lineWidth: 2 }
          },
          y: {
            title: { display: true, text: "% TdP Risk", font: { size: 18, weight: "bold" } },
            ticks: { font: { size: 16, weight: "bold" } },
            grid: { lineWidth: 2 }
          }
        },
        plugins: {
          legend: { display: false, labels: { font: { size: 16, weight: "bold" } } }
        }
      }
;

  document.getElementById("toggleModelBtn").addEventListener("click", () => {
    isModel1 = !isModel1;
    updateModelPanel();

  document.getElementById("riskForm").addEventListener("submit", e => {
    e.preventDefault();
    const cmaxRaw=parseFloat(document.getElementById("cmax").value),
          Cmax=cmaxIsNM?cmaxRaw/1000:cmaxRaw,
          arr=parseInt(document.getElementById("arrhythmia").value),
          cell=parseFloat(document.getElementById("celltype").value),
          assay=document.getElementById("assay").value;
    const rows=document.querySelectorAll("#dataBody tr"),
          concs=[], fpdcs=[];
    rows.forEach(r=>{
      const [i1,i2]=r.querySelectorAll("input");
      const c=parseFloat(i1.value), f=parseFloat(i2.value);
      if(!isNaN(c)&&!isNaN(f)){concs.push(c);fpdcs.push(f);}
    if(concs.length<3){alert("Please enter at least 3 data points.");return;}
    // Hill fit
    const Bottom=Math.min(...fpdcs), Top=Math.max(...fpdcs),
          guess={Bottom,Top,EC50:median(concs),Hill:1},
          hill=(x,p)=>p.Bottom+(p.Top-p.Bottom)/(1+Math.pow(p.EC50/x,p.Hill)),
          loss=p=>fpdcs.reduce((s,y,i)=>s+Math.pow(hill(concs[i]||0.01,p)-y,2),0);
    let best= {...guess}, ml=Infinity;
    for(let h=0.1;h<=5;h+=0.1)for(let ec=0.01;ec<=Math.max(...concs)*10;ec+=0.1){
      const t={...guess,EC50:ec,Hill:h},err=loss(t);
      if(err<ml){ml=err;best=t;}
    }
    const FPD_Cmax=hill(Cmax||0.01,best);
    // Probabilities
    const P1=-0.1311+arr+Math.max(...fpdcs)*0.00687+FPD_Cmax*0.0232;
    Prob1=1/(1+Math.exp(-P1));
    const P2a=-2.1102+cell*0.2211+0.00105*Math.max(...fpdcs)+0.0338*FPD_Cmax+arr;
    const P2b=-0.1211+cell*0.2211+0.00105*Math.max(...fpdcs)+0.0338*FPD_Cmax+arr;
    Prob2a=1/(1+Math.exp(-P2a));
    Prob2b=1/(1+Math.exp(-P2b));
    // Update QT output
    const Thr=assay==="30"?Bottom*1.103:Bottom*1.0794,
          logM=assay==="30"? (Thr+0.35)/0.92:(Thr+0.17)/0.93;
    document.getElementById("estimatedQTc").innerHTML=`
      <strong>Estimated QTc (log M):</strong> ${logM.toFixed(4)}<br>
      <strong>Estimated Concentration to induce >10ms QT prolongation:</strong> ${Math.pow(10,logM).toFixed(4)} µM`;
    // Initial model1 display
    isModel1=true;
    updateModelPanel();
    // Hill chart
    const minC=Math.max(0.001,Math.min(...concs)), maxC=Math.max(...concs);
    const fitX=Array.from({length:100},(_,i)=>Math.pow(10,Math.log10(minC)+i*(Math.log10(maxC)-Math.log10(minC))/99));
    const fitY=fitX.map(x=>hill(x,best));
    if(hillChart)hillChart.destroy();
    hillChart=new Chart(document.getElementById("hillPlot"),{
      type:"line",
      data:{labels:fitX,datasets:[
        {label:"Hill Fit Curve",data:fitX.map((x,i)=>({x,y:fitY[i]})),borderWidth:2,fill:false,tension:0.1},
        {label:"Cmax Point",data:[{x:Cmax,y:FPD_Cmax}],pointBackgroundColor:"#ff6b6b",pointRadius:6,type:"scatter"}
      ]},
      options:{scales:{x:{type:"logarithmic",title:{display:true,text:"Concentration (µM)"}},y:{title:{display:true,text:"FPDc (ms)"}}},plugins:{legend:{position:"top"}}}
};
