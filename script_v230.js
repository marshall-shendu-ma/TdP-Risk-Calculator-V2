window.onload = function () {
  let hillChart, barChart;
  let cmaxIsNM = true;

  // Cmax unit toggle
  document.getElementById("switchCmaxUnit").addEventListener("click", function () {
    const cmaxInput = document.getElementById("cmax");
    const cmaxLabel = document.getElementById("cmaxLabel");
    let value = parseFloat(cmaxInput.value);
    if (isNaN(value)) return;
    if (cmaxIsNM) {
      value = value / 1000;
      cmaxLabel.innerText = "Cmax (µM)";
    } else {
      value = value * 1000;
      cmaxLabel.innerText = "Cmax (nM)";
    }
    cmaxInput.value = value.toFixed(4);
    cmaxIsNM = !cmaxIsNM;
  });

  // Add/remove rows
  window.addRow = function () {
    const tbody = document.getElementById("dataBody");
    const newRow = document.createElement("tr");
    newRow.innerHTML = `
      <td><input type="number" step="any" required name="concentration[]"></td>
      <td><input type="number" step="any" required name="fpdc[]"></td>
      <td><button type="button" onclick="removeRow(this)">−</button></td>
    `;
    tbody.appendChild(newRow);
  };
  window.removeRow = function (btn) {
    const row = btn.closest("tr");
    if (row) row.remove();
  };

  // Median helper
  function median(arr) {
    const sorted = [...arr].sort((a,b)=>a-b);
    const mid = Math.floor(sorted.length/2);
    return arr.length%2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
  }

  // Form submit and plotting
  document.getElementById("riskForm").addEventListener("submit", function (e) {
    e.preventDefault();
    // Gather inputs
    const cmaxRaw = parseFloat(document.getElementById("cmax").value);
    const Cmax = cmaxIsNM ? cmaxRaw/1000 : cmaxRaw;
    const arrhythmia = parseInt(document.getElementById("arrhythmia").value);
    const cellType = parseFloat(document.getElementById("celltype").value);
    const assayTime = document.getElementById("assay").value;

    // Data rows
    const rows = document.querySelectorAll("#dataBody tr");
    const concentrations = [], fpdcs = [];
    rows.forEach(row => {
      const inputs = row.querySelectorAll("input");
      const conc = parseFloat(inputs[0].value);
      const fpd = parseFloat(inputs[1].value);
      if (!isNaN(conc) && !isNaN(fpd)) {
        concentrations.push(conc);
        fpdcs.push(fpd);
      }
    });
    if (concentrations.length < 3) {
      alert("Please enter at least 3 data points.");
      return;
    }

    // Hill fit
    const Bottom = Math.min(...fpdcs);
    const Top = Math.max(...fpdcs);
    const guess = { Bottom, Top, EC50: median(concentrations), Hill: 1 };
    const hillFunc = (x,p) => p.Bottom + (p.Top-p.Bottom)/(1+Math.pow(p.EC50/x,p.Hill));
    const loss = p => fpdcs.reduce((s,y,i) => s + Math.pow(hillFunc(concentrations[i]||0.01,p)-y,2), 0);

    let best = {...guess}, minL = Infinity;
    for (let h=0.1; h<=5; h+=0.1) {
      for (let ec=0.01; ec<=Math.max(...concentrations)*10; ec+=0.1) {
        const t = {...guess, EC50: ec, Hill: h};
        const err = loss(t);
        if (err < minL) {
          minL = err;
          best = t;
        }
      }
    }

    const FPD_Cmax = hillFunc(Cmax||0.01, best);
    const P1 = -0.1311 + arrhythmia + Math.max(...fpdcs)*0.00687 + FPD_Cmax*0.0232;
    const Prob1 = 1/(1+Math.exp(-P1));
    const P2a = -2.1102 + cellType*0.2211 + 0.00105*Math.max(...fpdcs) + 0.0338*FPD_Cmax + arrhythmia;
    const P2b = -0.1211 + cellType*0.2211 + 0.00105*Math.max(...fpdcs) + 0.0338*FPD_Cmax + arrhythmia;
    const Prob2a = 1/(1+Math.exp(-P2a));
    const Prob2b = 1/(1+Math.exp(-P2b));

    // Update outputs
    document.getElementById("model1Risk").innerHTML = `
      <p><strong>High/Intermediate TdP Risk:</strong> ${(Prob1*100).toFixed(1)}%</p>
      <p><strong>Low TdP Risk:</strong> ${((1-Prob1)*100).toFixed(1)}%</p>
    `;
    document.getElementById("estimatedQTc").innerHTML = `
      <strong>Estimated QTc (log M):</strong> ${
        (assayTime==="30" ? (Bottom*1.103+0.35)/0.92 : (Bottom*1.0794+0.17)/0.93).toFixed(4)
      }<br>
      <strong>Converted to µM:</strong> ${
        Math.pow(10,(assayTime==="30" ? (Bottom*1.103+0.35)/0.92 : (Bottom*1.0794+0.17)/0.93)).toFixed(4)
      } µM
    `;

    // Model 2 bar chart
    if (barChart) barChart.destroy();
    barChart = new Chart(document.getElementById("riskBarChart"), {
      type: "bar",
      data: {
        labels: ["High", "Intermediate", "Low"],
        datasets: [{
          label: "% TdP Risk (Model 2)",
          data: [Prob2a*100, Prob2b*100, (1-Prob2a-Prob2b)*100],
          backgroundColor: ["#d9534f", "#f0ad4e", "#5cb85c"]
        }]
      },
      options: { scales: { y: { beginAtZero: true, max: 100 } } }
    });

    // Hill fit curve
    const minC = Math.max(0.001, Math.min(...concentrations));
    const maxC = Math.max(...concentrations);
    const fitX = Array.from({length:100},(_,i)=>Math.pow(10,Math.log10(minC)+i*(Math.log10(maxC)-Math.log10(minC))/99));
    const fitY = fitX.map(x=>hillFunc(x,best));
    if (hillChart) hillChart.destroy();
    hillChart = new Chart(document.getElementById("hillPlot"), {
      type: "line",
      data: {
        labels: fitX,
        datasets: [
          {
            label: "Hill Fit Curve",
            data: fitX.map((x,i)=>({x,y:fitY[i]})),
            borderWidth: 2,
            borderColor: "#2c7be5",
            fill: false,
            tension: 0.1
          },
          {
            label: "Cmax Point",
            data: [{x:Cmax,y:FPD_Cmax}],
            pointBackgroundColor: "#ff6b6b",
            pointRadius: 6,
            type: "scatter"
          }
        ]
      },
      options: {
        scales: {
          x: { type: "logarithmic", title: { display: true, text: "Concentration (µM)" } },
          y: { title: { display: true, text: "FPDc (ms)" } }
        },
        plugins: {
          tooltip: { enabled: true },
          legend: { position: "top" }
        }
      }
    });
  });
};