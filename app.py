from flask import Flask, render_template, request, jsonify
import sqlite3
from datetime import datetime

app = Flask(__name__)
DB_PATH = "financas.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        tipo TEXT NOT NULL,
        cor TEXT DEFAULT '#6366f1',
        icone TEXT DEFAULT '💰'
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS transacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descricao TEXT NOT NULL,
        valor REAL NOT NULL,
        tipo TEXT NOT NULL,
        categoria_id INTEGER,
        data TEXT NOT NULL
    )""")
    c.execute("SELECT COUNT(*) FROM categorias")
    if c.fetchone()[0] == 0:
        cats = [
            ('Salário', 'receita', '#10b981', '💼'),
            ('Investimentos', 'receita', '#22c55e', '📈'),
            ('Alimentação', 'despesa', '#ef4444', '🍔'),
            ('Moradia', 'despesa', '#f97316', '🏠'),
            ('Transporte', 'despesa', '#3b82f6', '🚗'),
            ('Saúde', 'despesa', '#ec4899', '💊'),
            ('Lazer', 'despesa', '#a855f7', '🎮'),
            ('Educação', 'despesa', '#06b6d4', '📚'),
            ('Dívidas', 'despesa', '#f59e0b', '💳'),
        ]
        c.executemany("INSERT INTO categorias (nome, tipo, cor, icone) VALUES (?, ?, ?, ?)", cats)
    conn.commit()
    conn.close()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/categorias", methods=["GET", "POST"])
def categorias():
    conn = get_db()
    if request.method == "POST":
        d = request.json
        conn.execute("INSERT INTO categorias (nome, tipo, cor, icone) VALUES (?, ?, ?, ?)",
                     (d["nome"], d["tipo"], d.get("cor", "#6366f1"), d.get("icone", "💰")))
        conn.commit()
        conn.close()
        return jsonify({"ok": True})
    cats = [dict(r) for r in conn.execute("SELECT * FROM categorias ORDER BY nome").fetchall()]
    conn.close()
    return jsonify(cats)

@app.route("/api/categorias/<int:id>", methods=["DELETE"])
def del_categoria(id):
    conn = get_db()
    conn.execute("DELETE FROM transacoes WHERE categoria_id = ?", (id,))
    conn.execute("DELETE FROM categorias WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.route("/api/transacoes", methods=["GET", "POST"])
def transacoes():
    conn = get_db()
    if request.method == "POST":
        d = request.json
        conn.execute("INSERT INTO transacoes (descricao, valor, tipo, categoria_id, data) VALUES (?, ?, ?, ?, ?)",
                     (d["descricao"], d["valor"], d["tipo"], d["categoria_id"], d["data"]))
        conn.commit()
        conn.close()
        return jsonify({"ok": True})
    rows = conn.execute("""SELECT t.*, c.nome as categoria_nome, c.cor, c.icone
                           FROM transacoes t LEFT JOIN categorias c ON t.categoria_id = c.id
                           ORDER BY t.data DESC, t.id DESC""").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/transacoes/<int:id>", methods=["DELETE"])
def del_transacao(id):
    conn = get_db()
    conn.execute("DELETE FROM transacoes WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.route("/api/resumo")
def resumo():
    conn = get_db()
    receitas = conn.execute("SELECT COALESCE(SUM(valor),0) as t FROM transacoes WHERE tipo='receita'").fetchone()["t"]
    despesas = conn.execute("SELECT COALESCE(SUM(valor),0) as t FROM transacoes WHERE tipo='despesa'").fetchone()["t"]
    por_cat = [dict(r) for r in conn.execute("""
        SELECT c.nome, c.cor, c.icone, SUM(t.valor) as total
        FROM transacoes t JOIN categorias c ON t.categoria_id = c.id
        WHERE t.tipo='despesa'
        GROUP BY c.id ORDER BY total DESC
    """).fetchall()]
    conn.close()
    return jsonify({
        "saldo": receitas - despesas,
        "receitas": receitas,
        "despesas": despesas,
        "por_categoria": por_cat
    })

if __name__ == "__main__":
    init_db()
    app.run(debug=True)
