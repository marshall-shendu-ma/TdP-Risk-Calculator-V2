
let hillChart, barChart;
let cmaxIsNM = true;
let Prob_Model1, Prob_Model2a, Prob_Model2b;
let currentModel = 2;
window.onload = function () {
  let hillChart, barChart;
  let cmaxIsNM = true;

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

  function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  document.getElementById("riskForm").addEventListener("submit", function (e) {
    e.preventDefault();

    const cmaxRaw = parseFloat(document.getElementById("cmax").value);
    const Cmax = cmaxIsNM ? cmaxRaw / 1000 : cmaxRaw;
    const arrhythmia = parseInt(document.getElementById("arrhythmia").value);
    const cellType = parseFloat(document.getElementById("celltype").value);
    const assayTime = document.getElementById("assay").value;

    const rows = document.querySelectorAll("#dataBody tr");
    const concentrations = [];
    const fpdcs = [];
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

    const Bottom = Math.min(...fpdcs);
    const Top = Math.max(...fpdcs);
    const guess = { Bottom, Top, EC50: median(concentrations), Hill: 1 };

    const hillFunc = (x, params) =>
      params.Bottom + (params.Top - params.Bottom) / (1 + Math.pow(params.EC50 / x, params.Hill));

    const loss = (params) => {
      return fpdcs.reduce((sum, y, i) => {
        const x = concentrations[i] || 0.01;
        return sum + Math.pow(hillFunc(x, params) - y, 2);
      }, 0);
    };

    let bestParams = { ...guess };
    let minLoss = Infinity;
    for (let h = 0.1; h <= 5; h += 0.1) {
      for (let ec = 0.01; ec <= Math.max(...concentrations) * 10; ec += 0.1) {
        const trial = { ...guess, EC50: ec, Hill: h };
        const err = loss(trial);
        if (err < minLoss) {
          minLoss = err;
          bestParams = trial;
        }
      }
    }

    const FPD_Cmax = hillFunc(Cmax || 0.01, bestParams);
    const Predictor1 = arrhythmia;
    const Predictor4 = Math.max(...fpdcs);
    const Predictor7 = FPD_Cmax;

    const Threshold_FPDc = assayTime === "30" ? Bottom * 1.103 : Bottom * 1.0794;
    const EstQTcLogM = assayTime === "30"
      ? (Threshold_FPDc + 0.35) / 0.92
      : (Threshold_FPDc + 0.17) / 0.93;
    const EstQTc_uM = Math.pow(10, EstQTcLogM);

    const Threshold_C = bestParams.EC50 / Math.pow((bestParams.Top - bestParams.Bottom) / (Threshold_FPDc - bestParams.Bottom) - 1, 1 / bestParams.Hill);
    const Threshold_C_logM = Math.log10(Threshold_C * 1e-6);

    const P1_High = -0.1311 + Predictor1 + Predictor4 * 0.00687 + Predictor7 * 0.0232;
    Prob_Model1 = 1 / (1 + Math.exp(-P1_High));

    const P2_a = -2.1102 + cellType * 0.2211 + 0.00105 * Predictor4 + 0.0338 * Predictor7 + Predictor1;
    Prob_Model2a = 1 / (1 + Math.exp(-P2_a));

    const P2_b = -0.1211 + cellType * 0.2211 + 0.00105 * Predictor4 + 0.0338 * Predictor7 + Predictor1;
    Prob_Model2b = 1 / (1 + Math.exp(-P2_b));

    document.getElementById("estimatedQTc").innerHTML = `
      <strong>Estimated QTc (log M):</strong> ${EstQTcLogM.toFixed(4)}<br>
      <strong>Converted to µM:</strong> ${EstQTc_uM.toFixed(4)} µM
    `;

    document.getElementById("model1Risk").innerHTML = `
      <p><strong>High/Intermediate TdP Risk:</strong> ${(Prob_Model1 * 100).toFixed(1)}%</p>
      <p><strong>Low TdP Risk:</strong> ${((1 - Prob_Model1) * 100).toFixed(1)}%</p>
    `;

    if (barChart) barChart.destroy();
    barChart = new Chart(document.getElementById("riskBarChart"), {
      type: "bar",
      data: {
        labels: ["High", "Intermediate", "Low"],
        datasets: [{
          label: "% TdP Risk (Model 2)",
          data: [Prob_Model2a * 100, Prob_Model2b * 100, (1 - Prob_Model2a - Prob_Model2b) * 100],
          backgroundColor: ["#d9534f", "#f0ad4e", "#5cb85c"]
        }]
      },
      options: { scales: { y: { beginAtZero: true, max: 100 } } }
    });

    const minConc = Math.max(0.001, Math.min(...concentrations));
    const maxConc = Math.max(...concentrations);
    const fitX = Array.from({ length: 100 }, (_, i) =>
      Math.pow(10, Math.log10(minConc) + i * (Math.log10(maxConc) - Math.log10(minConc)) / 99)
    );
    const fitY = fitX.map(x => hillFunc(x, bestParams));

    if (hillChart) hillChart.destroy();
    hillChart = new Chart(document.getElementById("hillPlot"), {
      type: "line",
      data: {
        labels: fitX,
        datasets: [
          {
            label: "Hill Fit Curve",
            data: fitX.map((x, i) => ({ x, y: fitY[i] })),
            borderWidth: 2,
            borderColor: "#2c7be5",
            fill: false,
            tension: 0.1
          },
          {
            label: "Cmax Point",
            data: [{ x: Cmax, y: FPD_Cmax }],
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
