
let isModel1 = false;
let showInNM = false;
let qtcLogM = null;
let cmaxIsNM = true;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("riskForm").addEventListener("submit", function (e) {
    e.preventDefault();
    processInput();
  });
});

function toggleQTUnit() {
  if (qtcLogM === null) return;
  const value = Math.pow(10, qtcLogM);
  const converted = showInNM ? value * 1e6 : value * 1e9;
  const unit = showInNM ? "µM" : "nM";
  document.getElementById("qtcValue").innerText = `${converted.toFixed(8)} ${unit}`;
  document.querySelector("#estimatedQTc button").innerText = showInNM ? "Switch to nM" : "Switch to µM";
  showInNM = !showInNM;
}

function switchModel() {
  isModel1 = !isModel1;
  const chartTitle = document.getElementById("riskChartTitle");
  const description = document.getElementById("modelRiskDescription");
  chartTitle.firstChild.textContent = isModel1 ? "Model 1 TdP Risk " : "Model 2 TdP Risk ";
  description.textContent = isModel1 ? "Logistic regression" : "Ordinal regression";
  drawRiskChart(isModel1);
}

function drawRiskChart(model1) {
  const ctx = document.getElementById("riskBarChart").getContext("2d");
  if (window.riskChart) window.riskChart.destroy();
  const data = model1 ? [0.45, 0.55, 0] : [0.3, 0.4, 0.3];
  const labels = model1 ? ["High or Intermediate Risk", "Low Risk", ""] : ["High Risk", "Intermediate Risk", "Low Risk"];
  window.riskChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ["#e74c3c", "#f39c12", "#2ecc71"],
        borderWidth: 1
      }]
    },
    options: {
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 1
        }
      }
    }
  });
}

function updateQTcDisplay(logValue) {
  qtcLogM = logValue;
  showInNM = false;
  document.getElementById("qtcValueLog").innerText = logValue.toFixed(4);
  const value = Math.pow(10, logValue) * 1e9;
  document.getElementById("qtcValue").innerText = `${value.toFixed(8)} nM`;
  document.querySelector("#estimatedQTc button").innerText = "Switch to µM";
}

function drawHillPlot(xVals, yVals, cmax, fittedFunc) {
  const ctx = document.getElementById("hillPlot").getContext("2d");
  if (window.hillChart) window.hillChart.destroy();

  const logXVals = xVals.map(x => Math.log10(x));
  const logCmax = Math.log10(cmax);
  const fitX = [], fitY = [];
  const minX = Math.min(...xVals) * 0.5;
  const maxX = Math.max(...xVals) * 1.5;

  for (let x = minX; x <= maxX; x *= 1.05) {
    const fx = fittedFunc(x);
    if (isNaN(fx)) {
      alert("Error: Hill fit did not converge. Please check input data.");
      return;
    }
    fitX.push(Math.log10(x));
    fitY.push(fx);
  }

  window.hillChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: fitX,
      datasets: [
        {
          label: 'Hill Fit Curve',
          data: fitY,
          borderColor: '#007bff',
          borderWidth: 2,
          fill: false,
          pointRadius: 0
        },
        {
          label: 'Data Points',
          type: 'scatter',
          data: logXVals.map((x, i) => ({ x: x, y: yVals[i] })),
          backgroundColor: '#ff6384',
          pointRadius: 5
        },
        {
          label: 'Cmax',
          type: 'line',
          data: [
            { x: logCmax, y: Math.min(...yVals) },
            { x: logCmax, y: Math.max(...yVals) }
          ],
          borderColor: '#28a745',
          borderWidth: 2,
          borderDash: [6, 4],
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'log₁₀[Concentration (µM)]' } },
        y: { title: { display: true, text: 'FPDc (ms)' } }
      }
    }
  });
}

function processInput() {
  let cmax = parseFloat(document.getElementById("cmax").value);
  if (isNaN(cmax)) {
    alert("Please enter a valid Cmax value.");
    return;
  }
  if (!cmaxIsNM) cmax *= 1000;

  const tableRows = document.querySelectorAll("#dataBody tr");
  const conc = [], fpd = [];
  for (let row of tableRows) {
    const inputs = row.querySelectorAll("input");
    const x = parseFloat(inputs[0].value);
    const y = parseFloat(inputs[1].value);
    if (!isNaN(x) && !isNaN(y)) {
      conc.push(x);
      fpd.push(y);
    }
  }
  if (conc.length < 2 || fpd.length < 2) {
    alert("Please enter at least two valid data pairs.");
    return;
  }

  const Emax = Math.max(...fpd);
  const EC50 = conc[Math.floor(conc.length / 2)];
  const HillSlope = 1.2;
  const fittedFunc = (x) => {
    const denom = Math.pow(EC50, HillSlope) + Math.pow(x, HillSlope);
    return denom === 0 ? NaN : Emax * Math.pow(x, HillSlope) / denom;
  };

  drawHillPlot(conc, fpd, cmax, fittedFunc);
  updateQTcDisplay(-8.2);
  drawRiskChart(isModel1);
}
