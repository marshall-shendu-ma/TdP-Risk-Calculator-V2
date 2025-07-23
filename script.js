function addRow() {
  const tbody = document.querySelector("#dataTable tbody");
  const row = document.createElement("tr");
  row.innerHTML = '<td><input type="number" step="any"/></td><td><input type="number" step="any"/></td>';
  tbody.appendChild(row);
}

document.getElementById("inputForm").addEventListener("submit", function(event) {
  event.preventDefault();
  const cmax_nM = parseFloat(document.getElementById("cmax").value);
  const arrType = document.getElementById("arrType").value;
  const cellType = parseInt(document.getElementById("cellType").value);
  const assayTime = document.getElementById("assayTime").value;

  const rows = document.querySelectorAll("#dataTable tbody tr");
  const conc = [], fpd = [];
  rows.forEach(row => {
    const c = parseFloat(row.cells[0].children[0].value);
    const f = parseFloat(row.cells[1].children[0].value);
    if (!isNaN(c) && !isNaN(f)) {
      conc.push(c);
      fpd.push(f);
    }
  });

  // Placeholder: pass to a backend or implement the model logic here
  document.getElementById("modelOutput").innerHTML = `
    <p><strong>Inputs received:</strong></p>
    <p>Cmax: ${cmax_nM} nM<br>Arrhythmia: ${arrType}<br>Cell Type: ${cellType}<br>Assay Time: ${assayTime}</p>
    <p><strong>Data Points:</strong><br>${conc.map((c,i)=>`[${c} µM, ${fpd[i]} ms]`).join("<br>")}</p>
    <p><em>Next: Fit Hill curve, compute risk scores, plot chart and curve here…</em></p>
  `;
});