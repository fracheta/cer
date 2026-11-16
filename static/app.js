const state = { categorias: [], transacoes: [], chart: null };

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast show ${type}`;
    setTimeout(() => el.className = 'toast', 3000);
}

async function loadCategorias() {
    const res = await fetch('/api/categorias');
    state.categorias = await res.json();
    renderCategorias();
    renderCategorySelect();
}

function renderCategorySelect() {
    const sel = document.getElementById('categoria');
    const tipo = document.getElementById('tipo').value;
    const filtered = state.categorias.filter(c => c.tipo === tipo);
    sel.innerHTML = filtered.map(c => `<option value="${c.id}">${c.icone} ${c.nome}</option>`).join('');
}

function renderCategorias() {
    const grid = document.getElementById('categoriasGrid');
    if (!state.categorias.length) {
        grid.innerHTML = '<p class="empty-state">Nenhuma categoria.</p>';
        return;
    }
    grid.innerHTML = state.categorias.map(c => `
        <div class="category-chip" style="border-color: ${c.cor}; background: ${c.cor}15">
            <span class="cat-icon">${c.icone}</span>
            <div class="cat-info">
                <span class="cat-name">${c.nome}</span>
                <span class="cat-tipo">${c.tipo}</span>
            </div>
            <button class="cat-del" onclick="delCategoria(${c.id})">×</button>
        </div>
    `).join('');
}

async function loadTransacoes() {
    const res = await fetch('/api/transacoes');
    state.transacoes = await res.json();
    renderTransacoes();
}

function renderTransacoes() {
    const list = document.getElementById('transacoesList');
    if (!state.transacoes.length) {
        list.innerHTML = '<li class="empty-state">Nenhum lançamento ainda.</li>';
        return;
    }
    list.innerHTML = state.transacoes.slice(0, 12).map(t => {
        const cor = t.cor || '#94a3b8';
        return `
        <li class="transaction-item">
            <div class="t-icon" style="background: ${cor}20; color: ${cor}">${t.icone || '💸'}</div>
            <div class="t-info">
                <span class="t-desc">${t.descricao}</span>
                <span class="t-meta">${t.categoria_nome || '—'} • ${fmtDate(t.data)}</span>
            </div>
            <span class="t-valor ${t.tipo}">${t.tipo === 'receita' ? '+' : '−'} ${fmt(t.valor)}</span>
            <button class="t-del" onclick="delTransacao(${t.id})">×</button>
        </li>`;
    }).join('');
}

async function loadResumo() {
    const res = await fetch('/api/resumo');
    const d = await res.json();
    document.getElementById('saldo').textContent = fmt(d.saldo);
    document.getElementById('receitas').textContent = fmt(d.receitas);
    document.getElementById('despesas').textContent = fmt(d.despesas);
    document.getElementById('saldo').style.color = d.saldo >= 0 ? 'var(--success)' : 'var(--danger)';
    renderChart(d.por_categoria);
    renderBreakdown(d.por_categoria, d.despesas);
}

function renderChart(data) {
    const ctx = document.getElementById('chartCategorias').getContext('2d');
    if (state.chart) state.chart.destroy();
    if (!data.length) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        return;
    }
    state.chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.nome),
            datasets: [{
                data: data.map(d => d.total),
                backgroundColor: data.map(d => d.cor),
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmt(c.parsed)}` } }
            }
        }
    });
}

function renderBreakdown(data, total) {
    const el = document.getElementById('breakdownList');
    if (!data.length) {
        el.innerHTML = '<li class="empty-state">Nenhuma despesa registrada ainda.</li>';
        return;
    }
    el.innerHTML = data.map(d => {
        const pct = total > 0 ? ((d.total / total) * 100).toFixed(1) : 0;
        return `
        <li class="breakdown-item">
            <div class="bd-icon" style="background: ${d.cor}20">${d.icone}</div>
            <div class="bd-info">
                <div class="bd-top"><span>${d.nome}</span><span>${fmt(d.total)}</span></div>
                <div class="bd-bar"><div class="bd-bar-fill" style="width: ${pct}%; background: ${d.cor}"></div></div>
            </div>
            <span class="bd-pct">${pct}%</span>
        </li>`;
    }).join('');
}

document.getElementById('formTransacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        descricao: document.getElementById('descricao').value,
        valor: parseFloat(document.getElementById('valor').value),
        data: document.getElementById('data').value,
        tipo: document.getElementById('tipo').value,
        categoria_id: parseInt(document.getElementById('categoria').value)
    };
    const res = await fetch('/api/transacoes', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    });
    if (res.ok) {
        toast('Lançamento adicionado!');
        e.target.reset();
        document.getElementById('data').value = new Date().toISOString().split('T')[0];
        renderCategorySelect();
        await Promise.all([loadTransacoes(), loadResumo()]);
    }
});

document.getElementById('tipo').addEventListener('change', renderCategorySelect);

document.getElementById('btnNovaCategoria').onclick = () => {
    document.getElementById('modalCategoria').classList.add('show');
};
document.getElementById('btnCancelarCat').onclick = () => {
    document.getElementById('modalCategoria').classList.remove('show');
};

document.getElementById('formCategoria').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        nome: document.getElementById('catNome').value,
        tipo: document.getElementById('catTipo').value,
        cor: document.getElementById('catCor').value,
        icone: document.getElementById('catIcone').value || '💰'
    };
    const res = await fetch('/api/categorias', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    });
    if (res.ok) {
        toast('Categoria criada!');
        document.getElementById('formCategoria').reset();
        document.getElementById('modalCategoria').classList.remove('show');
        await loadCategorias();
    }
});

async function delCategoria(id) {
    if (!confirm('Remover esta categoria? Os lançamentos vinculados também serão removidos.')) return;
    await fetch(`/api/categorias/${id}`, { method: 'DELETE' });
    toast('Categoria removida.');
    await Promise.all([loadCategorias(), loadTransacoes(), loadResumo()]);
}

async function delTransacao(id) {
    if (!confirm('Remover este lançamento?')) return;
    await fetch(`/api/transacoes/${id}`, { method: 'DELETE' });
    toast('Lançamento removido.');
    await Promise.all([loadTransacoes(), loadResumo()]);
}

async function init() {
    document.getElementById('data').value = new Date().toISOString().split('T')[0];
    document.getElementById('dataHoje').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    await loadCategorias();
    await Promise.all([loadTransacoes(), loadResumo()]);
}
init();
