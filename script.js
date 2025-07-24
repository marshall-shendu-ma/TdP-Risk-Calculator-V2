
window.onload = function () {

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

function removeRow(btn) {
  const row = btn.closest("tr");
  if (row) row.remove();
}


  document.getElementById("riskForm").addEventListener("submit", function (e) {
    e.preventDefault();

    const Cmax_nM = parseFloat(document.getElementById("cmax").value);
    const Cmax = cmaxIsNM ? Cmax_nM / 1000 : Cmax_nM;

  e.preventDefault();

  const Cmax_nM = parseFloat(document.getElementById("cmax").value);
  const Cmax = Cmax_nM / 1000;
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
};
