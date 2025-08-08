document.addEventListener('DOMContentLoaded', function() {
  let hillChart, modelChart, isModel1 = true;
  let Prob1=0, Prob2a=0, Prob2b=0, cmaxIsNM=false;

  // collapse toggles
  const cmaxHeader=document.getElementById('cmaxSectionHeader'),
        cmaxContent=document.getElementById('cmaxSectionContent'),
        hillHeader=document.getElementById('hillSectionHeader'),
        hillContent=document.getElementById('hillSectionContent');
  cmaxHeader.addEventListener('click',()=>{
    if(cmaxContent.style.display==='none'){cmaxContent.style.display='';cmaxHeader.textContent='▾ Cmax Extrapolation';}
    else{cmaxContent.style.display='none';cmaxHeader.textContent='▸ Cmax Extrapolation';}
  });
  hillHeader.addEventListener('click',()=>{
    if(hillContent.style.display==='none'){hillContent.style.display='';hillHeader.textContent='▾ Hill Fit Curve (only available when input is filled in Cmax Extrapolation)';}
    else{hillContent.style.display='none';hillHeader.textContent='▸ Hill Fit Curve (only available when input is filled in Cmax Extrapolation)';}
  });

  // QT collapse
  const qtHeader = document.getElementById('qtSectionHeader'),
        qtContent = document.getElementById('qtSectionContent');
  if (qtHeader && qtContent) {
    qtHeader.addEventListener('click', () => {
      if (qtContent.style.display === 'none') {
        qtContent.style.display = '';
        qtHeader.textContent = '▾ QT Prolongation Prediction (in progress)';
      } else {
        qtContent.style.display = 'none';
        qtHeader.textContent = '▸ QT Prolongation Prediction (in progress)';
      }
    });
  }


  // switch unit
  document.getElementById('switchCmaxUnit').addEventListener('click',()=>{
    const inp=document.getElementById('cmax'), lbl=document.getElementById('cmaxLabel');
    let v=parseFloat(inp.value); if(isNaN(v))return;
    if(cmaxIsNM){v/=1000;lbl.innerText='Cmax (µM)';}else{v*=1000;lbl.innerText='Cmax (nM)';}
    inp.value=v.toFixed(4); cmaxIsNM=!cmaxIsNM;
  });

  window.addRow=()=>{const tb=document.getElementById('dataBody'),r=document.createElement('tr');r.innerHTML='<td><input name="concentration[]" type="number" step="any" required></td><td><input name="fpdc[]" type="number" step="any" required></td><td><button type="button" onclick="removeRow(this)">−</button></td>';tb.appendChild(r);};
  window.removeRow=btn=>btn.closest('tr').remove();

  document.getElementById('toggleModelBtn').addEventListener('click',()=>{isModel1=!isModel1;updateModelPanel();});
  document.getElementById('predictorCalcBtn').addEventListener('click',()=>calculate(true));
  document.getElementById('riskForm').addEventListener('submit',e=>{e.preventDefault();calculate(false);});

  function calculate(predOnly){
    let arr,p4,p7,cell=0,assay='30',Cmax,concs=[],fpdcs=[];
    if(predOnly){
      arr=parseInt(document.getElementById('predictor1').value);
      p4=parseFloat(document.getElementById('predictor4').value);
      p7=parseFloat(document.getElementById('predictor7').value);
      if(isNaN(arr)||isNaN(p4)||isNaN(p7)){alert('Fill predictors');return;}
      if(p4===0&&p7===0){alert('No drug-induced repolarization changes based on your Predictor Inputs. TdP risk cannot be justified.');}
    } else {
      Cmax=parseFloat(document.getElementById('cmax').value);
      if(cmaxIsNM)Cmax/=1000;
      arr=parseInt(document.getElementById('arrhythmia').value);
      cell=parseFloat(document.getElementById('celltype').value);
      assay=document.getElementById('assay').value;
      document.querySelectorAll('#dataBody tr').forEach(r=>{const [ci,fi]=r.querySelectorAll('input'),c=parseFloat(ci.value),f=parseFloat(fi.value);if(!isNaN(c)&&!isNaN(f)){concs.push(c);fpdcs.push(f);}});
      if(concs.length<3){alert('Enter ≥3 points');return;}
      p4=Math.max(...fpdcs);
      const Bottom=Math.min(...fpdcs),Top=Math.max(...fpdcs);
      const med=a=>{const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return a.length%2?s[m]:(s[m-1]+s[m])/2;};
      const guess={Bottom,Top,EC50:med(concs),Hill:1};
      const hillf=(x,p)=>p.Bottom+(p.Top-p.Bottom)/(1+Math.pow(p.EC50/x,p.Hill));
      let best={...guess},minE=Infinity;
      const loss=p=>fpdcs.reduce((s,y,i)=>s+Math.pow(hillf(concs[i],p)-y,2),0);
      for(let h=0.1;h<=5;h+=0.1)for(let ec=0.01;ec<=Math.max(...concs)*10;ec+=0.1){const t={...guess,EC50:ec,Hill:h},e=loss(t);if(e<minE){minE=e;best=t;} }
      const FPDc=hillf(Cmax||0.01,best);p7=FPDc;
      if(p4===0&&p7===0){alert('No drug-induced repolarization changes based on your Predictor Inputs. TdP risk cannot be justified.');}
      const Thr=assay==='30'?Bottom*1.103:Bottom*1.0794;
      const logM=assay==='30'?(Thr+0.35)/0.92:(Thr+0.17)/0.93;
      document.getElementById('estimatedQTc').innerHTML=`<strong>QTc (log M):</strong> ${logM.toFixed(4)}<br><strong>Conc >10ms QT:</strong> ${Math.pow(10,logM).toFixed(4)} µM`;
      const fitX=Array.from({length:100},(_,i)=>Math.pow(10,Math.log10(Math.max(0.001,Math.min(...concs)))+i*(Math.log10(Math.max(...concs))-Math.log10(Math.max(0.001,Math.min(...concs))))/99));
      const fitY=fitX.map(x=>hillf(x,best));
      if(hillChart)hillChart.destroy();
      hillChart=new Chart(document.getElementById('hillPlot'),{type:'line',data:{labels:fitX,datasets:[{label:'Hill Fit',data:fitX.map((x,i)=>({x,y:fitY[i]})),borderWidth:3,fill:false},{label:'Data',type:'scatter',data:concs.map((x,i)=>({x,y:fpdcs[i]})),pointRadius:4},{label:'Cmax',type:'scatter',data:[{x:Cmax,y:FPDc}],pointRadius:6}]},options:{scales:{x:{type:'logarithmic'},y:{}}}});
    }
    // model probabilities
    const map1=[0,0.6583,1.7944],map2a=[0,1.0551,2.1732],map2b=[0,0.3865,0.8737];
    const logit1=-0.1311+map1[arr]+0.00687*p4+0.0232*p7;
    Prob1=1/(1+Math.exp(-logit1));
    if(Prob1<0){alert('Model 1 returned a negative risk probability result and is not applicable for your Predictor Inputs.');}
    const logit2a=-0.1211+cell*0.2211+map2a[arr]+0.00105*p4+0.0338*p7;
    Prob2a=1/(1+Math.exp(-logit2a));
    const logit2b=-2.1102+cell*0.2211+map2b[arr]+0.00105*p4+0.0338*p7;
    Prob2b=1/(1+Math.exp(-logit2b));
    if(Prob2a<0||Prob2b<0||(1-Prob2a-Prob2b)<0){alert('Model 2 returned a negative risk probability result and is not applicable for your Predictor Inputs.');}
    updateModelPanel();
  }

  function updateModelPanel(){
    const title=document.getElementById('modelTitle'),sub=document.getElementById('modelSubtitle'),res=document.getElementById('modelResults');
    let labels,data,colors;
    if(isModel1){
      title.innerText='Model 1 TdP Risk'; sub.innerHTML='This model uses logistic regression.<br>The model outputs are:';
      labels=['High/Intermediate TdP Risk Probability','Low TdP Risk Probability'];
      data=[Prob1*100,(1-Prob1)*100];
    } else {
      title.innerText='Model 2 TdP Risk'; sub.innerHTML='This model uses ordinal regression.<br>The model outputs are:';
      labels=['High TdP Risk Probability','Intermediate TdP Risk Probability','Low TdP Risk Probability'];
      data=[Prob2a*100,Prob2b*100,(1-Prob2a-Prob2b)*100];
    }
    colors = labels.map(l => l.includes('High')? 'rgb(230,75,53)' : l.includes('Intermediate')? 'rgb(254,168,9)' : 'rgb(3,160,135)');
    res.innerHTML = '<ul style="margin-left:20px;">' + labels.map((l,i)=>`<li><strong>${l}:</strong> ${data[i].toFixed(1)}%</li>`).join('') + '</ul>';
    if(modelChart) modelChart.destroy();
    modelChart=new Chart(document.getElementById('modelChart'), {
      type:'bar',
      data:{labels,datasets:[{label:'% Risk',data,backgroundColor:colors}]},
      options:{ 
        scales:{
          x:{ grid:{lineWidth:5}, ticks:{font:{size:20}} },
          y:{ beginAtZero:true, max:100, grid:{lineWidth:5}, ticks:{font:{size:20}}}
        },
        plugins:{ legend:{display:false} }
      }
    });
  }
});