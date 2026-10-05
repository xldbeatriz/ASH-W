const KEY = "ashow_bar_v1";
const money = v => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v)||0);
const today = () => new Date().toISOString().slice(0,10);
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
let db = JSON.parse(localStorage.getItem(KEY) || "null") || {products:[],sales:[],expenses:[]};
let cart = [];

function save(){localStorage.setItem(KEY,JSON.stringify(db));document.getElementById("saveStatus").textContent="● Dados salvos";refreshAll()}
function toast(msg){const el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2400)}
function fmtDate(s){if(!s)return "—";return new Date(s+"T12:00:00").toLocaleDateString("pt-BR")}
function margin(cost,price){return price>0?((price-cost)/price)*100:0}
function saleCost(s){return s.items.reduce((a,i)=>a+i.cost*i.qty,0)}
function saleTotal(s){return s.items.reduce((a,i)=>a+i.price*i.qty,0)}
function periodStart(days){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-days+1);return d.toISOString().slice(0,10)}

function showPage(page){
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
  document.getElementById("page-"+page).classList.add("active");
  document.querySelectorAll(".nav-item[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  const names={dashboard:"Dashboard",products:"Produtos & Estoque",sales:"Registrar Venda",history:"Histórico de Vendas",expenses:"Gastos",reports:"Relatórios"};
  document.getElementById("pageTitle").textContent=names[page];
  document.getElementById("sidebar").classList.remove("open");
  if(page==="sales") renderSaleProductOptions();
  if(page==="reports") renderReports();
}
document.querySelectorAll(".nav-item[data-page]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.go)));
document.getElementById("menuBtn").onclick=()=>document.getElementById("sidebar").classList.toggle("open");
document.getElementById("quickSaleBtn").onclick=()=>showPage("sales");

function openModal(id){document.getElementById(id).classList.add("open")}
function closeModal(id){document.getElementById(id).classList.remove("open")}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));

function openProduct(id=null){
  document.getElementById("productForm").reset();
  document.getElementById("productId").value=id||"";
  document.getElementById("productModalTitle").textContent=id?"Editar produto":"Novo produto";
  if(id){
    const p=db.products.find(x=>x.id===id); if(!p)return;
    productName.value=p.name;productCategory.value=p.category||"";productStock.value=p.stock;
    productCost.value=p.cost;productPrice.value=p.price;updateProfitPreview();
  } else {productStock.value=0;updateProfitPreview()}
  openModal("productModal");
}
function updateProfitPreview(){
  const c=+productCost.value||0,p=+productPrice.value||0;
  profitPreview.textContent=`Margem: ${margin(c,p).toFixed(1)}% • Lucro por unidade: ${money(p-c)}`;
}
["productCost","productPrice"].forEach(id=>document.getElementById(id).addEventListener("input",updateProfitPreview));
document.getElementById("addProductBtn").onclick=()=>openProduct();

document.getElementById("productForm").onsubmit=e=>{
  e.preventDefault();
  const id=productId.value;
  const obj={id:id||uid("p"),name:productName.value.trim(),category:productCategory.value.trim()||"Sem categoria",stock:+productStock.value,cost:+productCost.value,price:+productPrice.value};
  if(!obj.name){toast("Digite o nome do produto.");return}
  if(id){const i=db.products.findIndex(x=>x.id===id);db.products[i]=obj;toast("Produto atualizado!")}
  else{db.products.push(obj);toast("Produto cadastrado!")}
  closeModal("productModal");save();
};
function renderProducts(){
  const q=(productSearch.value||"").toLowerCase(),f=stockFilter.value;
  let arr=db.products.filter(p=>(p.name+" "+p.category).toLowerCase().includes(q));
  if(f==="low")arr=arr.filter(p=>p.stock>0&&p.stock<=5);
  if(f==="zero")arr=arr.filter(p=>p.stock<=0);
  productsTable.innerHTML=arr.length?arr.map(p=>`<tr>
    <td><strong>${esc(p.name)}</strong></td><td>${esc(p.category)}</td><td>${money(p.cost)}</td><td class="money">${money(p.price)}</td>
    <td class="profit-positive">${money(p.price-p.cost)}</td><td>${margin(p.cost,p.price).toFixed(1)}%</td>
    <td class="${p.stock<=5?"stock-low":""}">${p.stock}</td>
    <td><div class="actions"><button class="action-btn" onclick="openProduct('${p.id}')">Editar</button><button class="action-btn delete" onclick="deleteProduct('${p.id}')">Apagar</button></div></td>
  </tr>`).join(""):`<tr><td colspan="8"><div class="empty">Nenhum produto encontrado.</div></td></tr>`;
}
function deleteProduct(id){
  const p=db.products.find(x=>x.id===id);
  if(!p)return;
  if(db.sales.some(s=>s.items.some(i=>i.productId===id))){if(!confirm("Este produto aparece em vendas antigas. Apagar mesmo assim?"))return}
  else if(!confirm(`Apagar "${p.name}"?`))return;
  db.products=db.products.filter(x=>x.id!==id);save();toast("Produto apagado.");
}
productSearch.oninput=renderProducts;stockFilter.onchange=renderProducts;

function renderSaleProductOptions(){
  saleProduct.innerHTML=db.products.length?`<option value="">Selecione um produto...</option>`+db.products.map(p=>`<option value="${p.id}" ${p.stock<=0?"disabled":""}>${esc(p.name)} — ${money(p.price)} (estoque: ${p.stock})</option>`).join(""):`<option value="">Cadastre produtos primeiro</option>`;
}
addToCartBtn.onclick=()=>{
  const p=db.products.find(x=>x.id===saleProduct.value),q=Math.max(1,+saleQty.value||1);
  if(!p){toast("Selecione um produto.");return}
  const existing=cart.find(x=>x.productId===p.id),newQty=(existing?.qty||0)+q;
  if(newQty>p.stock){toast("Quantidade maior que o estoque disponível.");return}
  if(existing)existing.qty=newQty;else cart.push({productId:p.id,name:p.name,cost:p.cost,price:p.price,qty:q});
  saleQty.value=1;renderCart();
};
function renderCart(){
  const total=cart.reduce((a,i)=>a+i.price*i.qty,0),cost=cart.reduce((a,i)=>a+i.cost*i.qty,0),items=cart.reduce((a,i)=>a+i.qty,0);
  cartItems.textContent=items;cartCost.textContent=money(cost);cartTotal.textContent=money(total);cartProfit.textContent=money(total-cost);
  cartList.innerHTML=cart.length?cart.map((i,n)=>`<div class="cart-row"><div><strong>${esc(i.name)}</strong><small>${money(i.price)} cada</small></div><div class="qty-box"><button onclick="changeCartQty(${n},-1)">−</button><span>${i.qty}</span><button onclick="changeCartQty(${n},1)">+</button></div><strong>${money(i.price*i.qty)}</strong><button class="remove-cart" onclick="cart.splice(${n},1);renderCart()">×</button></div>`).join(""):`<div class="empty">Sua venda está vazia.<br>Adicione produtos acima.</div>`;
}
function changeCartQty(n,d){
  const i=cart[n],p=db.products.find(x=>x.id===i.productId),q=i.qty+d;
  if(q<1){cart.splice(n,1)}else if(q>p.stock){toast("Estoque insuficiente.");return}else i.qty=q;
  renderCart();
}
saveSaleBtn.onclick=()=>{
  if(!cart.length){toast("Adicione pelo menos um produto.");return}
  const sale={id:uid("s"),date:today(),createdAt:new Date().toISOString(),payment:paymentMethod.value,note:saleNote.value.trim(),items:cart.map(x=>({...x}))};
  sale.items.forEach(i=>{const p=db.products.find(x=>x.id===i.productId);p.stock-=i.qty});
  db.sales.unshift(sale);cart=[];saleNote.value="";renderCart();save();toast("Venda salva com sucesso!");
};
clearCartBtn.onclick=()=>{cart=[];renderCart()};

function renderSales(){
  const q=(saleSearch.value||"").toLowerCase(),date=saleDateFilter.value;
  const arr=db.sales.filter(s=>(!date||s.date===date)&&((s.payment+" "+s.note+" "+s.date+" "+s.items.map(i=>i.name).join(" ")).toLowerCase().includes(q)));
  salesTable.innerHTML=arr.length?arr.map(s=>{const t=saleTotal(s),c=saleCost(s);return `<tr>
    <td>${fmtDate(s.date)}<small style="display:block;color:#999">${s.note?esc(s.note):""}</small></td>
    <td>${s.items.reduce((a,i)=>a+i.qty,0)} item(s)</td><td>${esc(s.payment)}</td><td class="money">${money(t)}</td><td>${money(c)}</td><td class="profit-positive">${money(t-c)}</td>
    <td><div class="actions"><button class="action-btn" onclick="editSale('${s.id}')">Editar</button><button class="action-btn delete" onclick="deleteSale('${s.id}')">Apagar</button></div></td>
  </tr>`}).join(""):`<tr><td colspan="7"><div class="empty">Nenhuma venda encontrada.</div></td></tr>`;
}
saleSearch.oninput=renderSales;saleDateFilter.onchange=renderSales;

function restoreStockForSale(s){s.items.forEach(i=>{const p=db.products.find(x=>x.id===i.productId);if(p)p.stock+=i.qty})}
function editSale(id){
  const s=db.sales.find(x=>x.id===id);if(!s)return;
  restoreStockForSale(s);
  cart=s.items.map(x=>({...x}));
  db.sales=db.sales.filter(x=>x.id!==id);
  paymentMethod.value=s.payment;saleNote.value=s.note||"";
  save();renderCart();showPage("sales");
  // next save creates a new sale using restored stock
  toast("Venda carregada para correção. Finalize novamente para salvar.");
}
function deleteSale(id){
  const s=db.sales.find(x=>x.id===id);if(!s)return;
  if(!confirm(`Excluir a venda de ${fmtDate(s.date)} no valor de ${money(saleTotal(s))}? O estoque será devolvido.`))return;
  restoreStockForSale(s);db.sales=db.sales.filter(x=>x.id!==id);save();toast("Venda excluída e estoque devolvido.");
}

document.getElementById("addExpenseBtn").onclick=()=>{
  expenseForm.reset();expenseId.value="";expenseDate.value=today();expenseModalTitle.textContent="Registrar gasto";openModal("expenseModal");
};
expenseForm.onsubmit=e=>{
  e.preventDefault();
  const id=expenseId.value,obj={id:id||uid("e"),description:expenseDescription.value.trim(),category:expenseCategory.value.trim()||"Outros",value:+expenseValue.value,date:expenseDate.value};
  if(id){const i=db.expenses.findIndex(x=>x.id===id);db.expenses[i]=obj;toast("Gasto atualizado!")}else{db.expenses.unshift(obj);toast("Gasto registrado!")}
  closeModal("expenseModal");save();
};
function editExpense(id){
  const e=db.expenses.find(x=>x.id===id);if(!e)return;
  expenseId.value=e.id;expenseDescription.value=e.description;expenseCategory.value=e.category;expenseValue.value=e.value;expenseDate.value=e.date;expenseModalTitle.textContent="Editar gasto";openModal("expenseModal");
}
function deleteExpense(id){if(!confirm("Apagar este gasto?"))return;db.expenses=db.expenses.filter(x=>x.id!==id);save();toast("Gasto apagado.")}
function renderExpenses(){
  const total=db.expenses.reduce((a,e)=>a+e.value,0);expenseTotal.textContent=money(total);
  expensesTable.innerHTML=db.expenses.length?db.expenses.map(e=>`<tr><td>${fmtDate(e.date)}</td><td><strong>${esc(e.description)}</strong></td><td>${esc(e.category)}</td><td class="money">${money(e.value)}</td><td><div class="actions"><button class="action-btn" onclick="editExpense('${e.id}')">Editar</button><button class="action-btn delete" onclick="deleteExpense('${e.id}')">Apagar</button></div></td></tr>`).join(""):`<tr><td colspan="5"><div class="empty">Nenhum gasto registrado.</div></td></tr>`;
}

function getReport(){
  const v=reportPeriod.value, start=v==="all"?null:periodStart(+v);
  const sales=db.sales.filter(s=>!start||s.date>=start),expenses=db.expenses.filter(e=>!start||e.date>=start);
  const revenue=sales.reduce((a,s)=>a+saleTotal(s),0),cost=sales.reduce((a,s)=>a+saleCost(s),0),gross=revenue-cost,exp=expenses.reduce((a,e)=>a+e.value,0);
  return {sales,expenses,revenue,cost,gross,exp,net:gross-exp};
}
function renderReports(){
  const r=getReport(),m=r.revenue?100*r.gross/r.revenue:0;
  reportRevenue.textContent=money(r.revenue);reportSalesCount.textContent=`${r.sales.length} venda(s)`;
  reportGrossProfit.textContent=money(r.gross);reportMargin.textContent=`Margem: ${m.toFixed(1)}%`;
  reportExpenses.textContent=money(r.exp);reportNet.textContent=money(r.net);
  const map={};r.sales.forEach(s=>s.items.forEach(i=>map[i.name]=(map[i.name]||0)+i.qty));
  const top=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,7),max=top[0]?.[1]||1;
  topProducts.innerHTML=top.length?top.map((x,i)=>`<div class="rank-row"><span class="rank-num">${i+1}</span><div><strong>${esc(x[0])}</strong><div class="progress"><i style="width:${x[1]/max*100}%"></i></div></div><strong>${x[1]} un.</strong></div>`).join(""):`<div class="empty">Sem vendas no período.</div>`;
  const pays={};r.sales.forEach(s=>pays[s.payment]=(pays[s.payment]||0)+saleTotal(s));const pt=Object.entries(pays).sort((a,b)=>b[1]-a[1]);const pm=pt[0]?.[1]||1;
  paymentReport.innerHTML=pt.length?pt.map(x=>`<div class="rank-row"><span class="rank-num">R$</span><div><strong>${esc(x[0])}</strong><div class="progress"><i style="width:${x[1]/pm*100}%"></i></div></div><strong>${money(x[1])}</strong></div>`).join(""):`<div class="empty">Sem vendas no período.</div>`;
}
reportPeriod.onchange=renderReports;

function renderDashboard(){
  const start=periodStart(30),sales=db.sales.filter(s=>s.date>=start),expenses=db.expenses.filter(e=>e.date>=start);
  const rev=sales.reduce((a,s)=>a+saleTotal(s),0),gross=sales.reduce((a,s)=>a+(saleTotal(s)-saleCost(s)),0),exp=expenses.reduce((a,e)=>a+e.value,0);
  dashRevenue.textContent=money(rev);dashProfit.textContent=money(gross);dashExpenses.textContent=money(exp);dashMargin.textContent=`Margem: ${rev?(gross/rev*100).toFixed(1):0}%`;
  dashProducts.textContent=db.products.length;dashLowStock.textContent=`${db.products.filter(p=>p.stock<=5).length} em estoque baixo`;
  const days=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const ds=d.toISOString().slice(0,10);days.push({d,ds,v:sales.filter(s=>s.date===ds).reduce((a,s)=>a+saleTotal(s),0)})}
  const mx=Math.max(...days.map(x=>x.v),1);revenueChart.innerHTML=days.map(x=>`<div class="bar-col"><div class="bar" title="${money(x.v)}" style="height:${Math.max(3,x.v/mx*100)}%"></div><span class="bar-label">${x.d.toLocaleDateString("pt-BR",{weekday:"short"}).replace(".","")}</span></div>`).join("");
  const low=db.products.filter(p=>p.stock<=5).sort((a,b)=>a.stock-b.stock).slice(0,6);
  lowStockList.innerHTML=low.length?low.map(p=>`<div class="low-row"><strong>${esc(p.name)}</strong><span class="badge">${p.stock} un.</span></div>`).join(""):`<div class="empty">Tudo certo por aqui! Nenhum estoque baixo.</div>`;
  recentSales.innerHTML=sales.slice(0,6).length?`<div class="table-wrap" style="box-shadow:none;border:0"><table style="min-width:0"><thead><tr><th>Data</th><th>Pagamento</th><th>Total</th><th>Lucro</th></tr></thead><tbody>${sales.slice(0,6).map(s=>`<tr><td>${fmtDate(s.date)}</td><td>${esc(s.payment)}</td><td class="money">${money(saleTotal(s))}</td><td class="profit-positive">${money(saleTotal(s)-saleCost(s))}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">Ainda não há vendas registradas.</div>`;
}

function refreshAll(){renderDashboard();renderProducts();renderSales();renderExpenses();renderSaleProductOptions();renderReports()}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

backupBtn.onclick=()=>{
  const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=`ashow-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);toast("Backup baixado!");
};
restoreInput.onchange=e=>{
  const file=e.target.files[0];if(!file)return;const reader=new FileReader();
  reader.onload=()=>{try{const x=JSON.parse(reader.result);if(!x.products||!x.sales||!x.expenses)throw Error();if(confirm("Restaurar este backup? Os dados atuais serão substituídos.")){db=x;save();toast("Backup restaurado!")}}catch{toast("Arquivo de backup inválido.")}e.target.value=""};reader.readAsText(file);
};
resetBtn.onclick=()=>{if(confirm("ATENÇÃO: isso apagará todos os produtos, vendas e gastos deste navegador. Continuar?")){db={products:[],sales:[],expenses:[]};cart=[];save();toast("Dados limpos.")}};

refreshAll();renderCart();
