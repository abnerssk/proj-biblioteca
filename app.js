// =====================================================
// CONFIGURAÇÃO DO SUPABASE
// =====================================================

const SUPABASE_URL = "https://vbtipvmzylabtnrmcfrv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_nhg9DPIdt8zNQknolLyZIg_7t63u4Dt";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const estado = {
    secaoAtual: "livros",
    livros: [],
    usuarios: [],
    emprestimos: [],
    buscaLivros: "",
    buscaUsuarios: "",
    buscaEmprestimos: "",
    confirmarCallback: null
};

const $ = (id) => document.getElementById(id);
const $$ = (seletor) => document.querySelectorAll(seletor);

// =====================================================
// UTILITÁRIOS
// =====================================================

function escaparHtml(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatarData(data) {
    if (!data) return "Não informado";
    const partes = String(data).split("-");
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return String(data);
}

function mostrarMensagem(id, titulo, subtitulo = "") {
    const lista = $(id);
    if (!lista) return;
    lista.innerHTML = `
        <div class="loading-state">
            <div>
                <strong>${escaparHtml(titulo)}</strong>
                ${subtitulo ? `<p>${escaparHtml(subtitulo)}</p>` : ""}
            </div>
        </div>
    `;
}

function mostrarEstadoVazio(id, titulo, subtitulo) {
    const lista = $(id);
    if (!lista) return;
    lista.innerHTML = `
        <div class="empty-state">
            <div>
                <strong>${escaparHtml(titulo)}</strong>
                <p>${escaparHtml(subtitulo)}</p>
            </div>
        </div>
    `;
}

function mostrarToast(mensagem, tipo = "info") {
    const container = $("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${tipo}`;
    toast.textContent = mensagem;
    container.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3600);
}

function setBotaoCarregando(formulario, carregando) {
    const botao = formulario?.querySelector("button[type='submit']");
    if (!botao) return;
    if (!botao.dataset.originalText) botao.dataset.originalText = botao.innerHTML;
    botao.disabled = carregando;
    botao.classList.toggle("loading", carregando);
    botao.innerHTML = carregando ? "Salvando..." : botao.dataset.originalText;
}

function dataDeHoje() {
    return new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long"
    }).format(new Date());
}

function erroDoSupabase(error) {
    return error?.message || "Ocorreu um erro inesperado.";
}

// =====================================================
// NAVEGAÇÃO
// =====================================================

function mostrarSecao(secao, foco = null) {
    const config = {
        livros: { titulo: "Livros", eyebrow: "ACERVO", heading: "Seu acervo, organizado." },
        usuarios: { titulo: "Usuários", eyebrow: "CADASTROS", heading: "Pessoas e empréstimos em ordem." },
        emprestimos: { titulo: "Empréstimos", eyebrow: "MOVIMENTAÇÃO", heading: "Controle cada saída e devolução." }
    };

    if (!config[secao]) return;
    estado.secaoAtual = secao;

    ["livros", "usuarios", "emprestimos"].forEach((id) => {
        const painel = $(id);
        if (painel) painel.hidden = id !== secao;
    });

    $$(".nav-item").forEach((botao) => {
        botao.classList.toggle("active", botao.dataset.section === secao);
    });

    $("pageTitle").textContent = config[secao].titulo;
    $("pageEyebrow").textContent = config[secao].eyebrow;
    $("sectionHeading").textContent = config[secao].heading;

    fecharMenuMobile();

    if (foco) {
        window.setTimeout(() => {
            $(foco)?.focus();
        }, 120);
    }
}

function abrirMenuMobile() {
    $("sidebar").classList.add("open");
    $("mobileOverlay").classList.add("visible");
}

function fecharMenuMobile() {
    $("sidebar").classList.remove("open");
    $("mobileOverlay").classList.remove("visible");
}

// Mantém compatibilidade com onclicks antigos, caso existam em alguma cópia local.
window.mostrarSecao = mostrarSecao;

// =====================================================
// CONFIRMAÇÃO
// =====================================================

function pedirConfirmacao(texto, callback) {
    estado.confirmarCallback = callback;
    $("modalText").textContent = texto;
    $("confirmModal").hidden = false;
    $("modalConfirm").focus();
}

function fecharConfirmacao() {
    $("confirmModal").hidden = true;
    estado.confirmarCallback = null;
}

// =====================================================
// INDICADORES
// =====================================================

function atualizarIndicadores() {
    const totalLivros = estado.livros.length;
    const disponiveis = estado.livros.filter((livro) => livro.disponivel === true).length;
    const totalUsuarios = estado.usuarios.length;
    const abertos = estado.emprestimos.filter((item) => item.devolvido !== true).length;
    const percentual = totalLivros ? Math.round((disponiveis / totalLivros) * 100) : 0;

    $("totalLivros").textContent = totalLivros;
    $("totalDisponiveis").textContent = disponiveis;
    $("totalUsuarios").textContent = totalUsuarios;
    $("totalAbertos").textContent = abertos;
    $("taxaDisponibilidade").textContent = `${percentual}%`;

    $("navLivrosCount").textContent = totalLivros;
    $("navUsuariosCount").textContent = totalUsuarios;
    $("navAbertosCount").textContent = abertos;
}

// =====================================================
// LIVROS
// =====================================================

async function carregarLivros() {
    mostrarMensagem("listaLivros", "Carregando acervo...");

    const { data, error } = await supabaseClient
        .from("livros")
        .select("*")
        .order("titulo", { ascending: true });

    if (error) {
        console.error("Erro ao carregar livros:", error);
        $("listaLivros").innerHTML = `<div class="error-state"><div><strong>Não foi possível carregar o acervo.</strong><p>${escaparHtml(erroDoSupabase(error))}</p></div></div>`;
        mostrarToast("Falha ao carregar os livros.", "error");
        return;
    }

    estado.livros = data || [];
    renderizarLivros();
    atualizarSelectLivros();
    atualizarIndicadores();
}

function renderizarLivros() {
    const termo = estado.buscaLivros.trim().toLocaleLowerCase("pt-BR");
    const livros = estado.livros.filter((livro) => {
        const titulo = String(livro.titulo || "").toLocaleLowerCase("pt-BR");
        const autor = String(livro.autor || "").toLocaleLowerCase("pt-BR");
        return !termo || titulo.includes(termo) || autor.includes(termo);
    });

    $("livrosResumo").textContent = `${livros.length} ${livros.length === 1 ? "registro" : "registros"}`;

    if (!livros.length) {
        mostrarEstadoVazio(
            "listaLivros",
            estado.livros.length ? "Nenhum livro encontrado." : "Nenhum livro cadastrado ainda.",
            estado.livros.length ? "Tente alterar o termo de busca." : "Use o formulário acima para adicionar o primeiro título."
        );
        return;
    }

    $("listaLivros").innerHTML = livros.map((livro) => {
        const disponivel = livro.disponivel === true;
        const botao = disponivel
            ? `<button class="delete-button" type="button" data-action="delete-book" data-id="${Number(livro.id)}">Excluir</button>`
            : `<p class="card-note">Este livro possui um empréstimo em aberto.</p>`;

        return `
            <article class="card">
                <div class="card-top">
                    <div class="card-main">
                        <h4 class="card-title" title="${escaparHtml(livro.titulo)}">${escaparHtml(livro.titulo)}</h4>
                        <p class="card-meta"><strong>Autor:</strong> ${escaparHtml(livro.autor)}</p>
                        <p class="card-meta"><strong>Ano:</strong> ${livro.ano ?? "Não informado"}</p>
                    </div>
                    <span class="status ${disponivel ? "available" : "borrowed"}">${disponivel ? "Disponível" : "Emprestado"}</span>
                </div>
                <div class="card-actions">${botao}</div>
            </article>
        `;
    }).join("");
}

function atualizarSelectLivros() {
    const select = $("livroEmprestimo");
    const atual = select.value;
    select.innerHTML = `<option value="">Selecione um livro</option>`;

    estado.livros
        .filter((livro) => livro.disponivel === true)
        .forEach((livro) => {
            const option = document.createElement("option");
            option.value = livro.id;
            option.textContent = `${livro.titulo} — ${livro.autor}`;
            select.appendChild(option);
        });

    if (estado.livros.some((livro) => String(livro.id) === atual && livro.disponivel === true)) {
        select.value = atual;
    }
}

async function salvarLivro(event) {
    event.preventDefault();
    const formulario = event.currentTarget;
    const titulo = $("titulo").value.trim();
    const autor = $("autor").value.trim();
    const ano = $("ano").value;

    if (!titulo || !autor) {
        mostrarToast("Preencha o título e o autor.", "error");
        return;
    }

    if (ano && (Number(ano) < 0 || Number(ano) > 9999)) {
        mostrarToast("Informe um ano válido.", "error");
        return;
    }

    setBotaoCarregando(formulario, true);
    const { error } = await supabaseClient.from("livros").insert({
        titulo,
        autor,
        ano: ano ? Number(ano) : null,
        disponivel: true
    });
    setBotaoCarregando(formulario, false);

    if (error) {
        console.error("Erro ao cadastrar livro:", error);
        mostrarToast(`Não foi possível cadastrar o livro: ${erroDoSupabase(error)}`, "error");
        return;
    }

    formulario.reset();
    mostrarToast("Livro cadastrado com sucesso.", "success");
    await carregarLivros();
}

async function excluirLivro(id) {
    const livro = estado.livros.find((item) => Number(item.id) === Number(id));
    if (!livro) return;

    pedirConfirmacao(`Excluir “${livro.titulo}”? Esta ação não poderá ser desfeita.`, async () => {
        const { data: emprestimos, error: erroBusca } = await supabaseClient
            .from("emprestimos")
            .select("id")
            .eq("livro_id", id);

        if (erroBusca) {
            console.error(erroBusca);
            mostrarToast("Não foi possível verificar o histórico do livro.", "error");
            return;
        }

        if (emprestimos?.length) {
            mostrarToast("O livro possui histórico de empréstimos e não pode ser excluído.", "error");
            return;
        }

        const { error } = await supabaseClient.from("livros").delete().eq("id", id);
        if (error) {
            console.error("Erro ao excluir livro:", error);
            mostrarToast("Não foi possível excluir o livro.", "error");
            return;
        }

        mostrarToast("Livro excluído.", "success");
        await carregarLivros();
    });
}

// =====================================================
// USUÁRIOS
// =====================================================

async function carregarUsuarios() {
    mostrarMensagem("listaUsuarios", "Carregando usuários...");

    const { data, error } = await supabaseClient
        .from("usuarios")
        .select("*")
        .order("nome", { ascending: true });

    if (error) {
        console.error("Erro ao carregar usuários:", error);
        $("listaUsuarios").innerHTML = `<div class="error-state"><div><strong>Não foi possível carregar os usuários.</strong><p>${escaparHtml(erroDoSupabase(error))}</p></div></div>`;
        mostrarToast("Falha ao carregar os usuários.", "error");
        return;
    }

    estado.usuarios = data || [];
    renderizarUsuarios();
    atualizarSelectUsuarios();
    atualizarIndicadores();
}

function renderizarUsuarios() {
    const termo = estado.buscaUsuarios.trim().toLocaleLowerCase("pt-BR");
    const usuarios = estado.usuarios.filter((usuario) => {
        const nome = String(usuario.nome || "").toLocaleLowerCase("pt-BR");
        const email = String(usuario.email || "").toLocaleLowerCase("pt-BR");
        return !termo || nome.includes(termo) || email.includes(termo);
    });

    $("usuariosResumo").textContent = `${usuarios.length} ${usuarios.length === 1 ? "registro" : "registros"}`;

    if (!usuarios.length) {
        mostrarEstadoVazio(
            "listaUsuarios",
            estado.usuarios.length ? "Nenhum usuário encontrado." : "Nenhum usuário cadastrado ainda.",
            estado.usuarios.length ? "Tente alterar o termo de busca." : "Cadastre o primeiro usuário usando o formulário acima."
        );
        return;
    }

    $("listaUsuarios").innerHTML = usuarios.map((usuario) => `
        <article class="card">
            <div class="card-top">
                <div class="card-main">
                    <h4 class="card-title" title="${escaparHtml(usuario.nome)}">${escaparHtml(usuario.nome)}</h4>
                    <p class="card-meta"><strong>E-mail:</strong> ${escaparHtml(usuario.email || "Não informado")}</p>
                </div>
                <span class="status available">Ativo</span>
            </div>
            <div class="card-actions">
                <p class="card-note">Cadastro disponível para empréstimos.</p>
                <button class="delete-button" type="button" data-action="delete-user" data-id="${Number(usuario.id)}">Excluir</button>
            </div>
        </article>
    `).join("");
}

function atualizarSelectUsuarios() {
    const select = $("usuarioEmprestimo");
    const atual = select.value;
    select.innerHTML = `<option value="">Selecione um usuário</option>`;

    estado.usuarios.forEach((usuario) => {
        const option = document.createElement("option");
        option.value = usuario.id;
        option.textContent = usuario.nome;
        select.appendChild(option);
    });

    if (estado.usuarios.some((usuario) => String(usuario.id) === atual)) select.value = atual;
}

async function salvarUsuario(event) {
    event.preventDefault();
    const formulario = event.currentTarget;
    const nome = $("nome").value.trim();
    const email = $("email").value.trim();

    if (!nome) {
        mostrarToast("Informe o nome do usuário.", "error");
        return;
    }

    setBotaoCarregando(formulario, true);
    const { error } = await supabaseClient.from("usuarios").insert({
        nome,
        email: email || null
    });
    setBotaoCarregando(formulario, false);

    if (error) {
        console.error("Erro ao cadastrar usuário:", error);
        mostrarToast(`Não foi possível cadastrar o usuário: ${erroDoSupabase(error)}`, "error");
        return;
    }

    formulario.reset();
    mostrarToast("Usuário cadastrado com sucesso.", "success");
    await carregarUsuarios();
}

async function excluirUsuario(id) {
    const usuario = estado.usuarios.find((item) => Number(item.id) === Number(id));
    if (!usuario) return;

    pedirConfirmacao(`Excluir “${usuario.nome}”? Esta ação não poderá ser desfeita.`, async () => {
        const { data: emprestimos, error: erroBusca } = await supabaseClient
            .from("emprestimos")
            .select("id")
            .eq("usuario_id", id);

        if (erroBusca) {
            console.error(erroBusca);
            mostrarToast("Não foi possível verificar o histórico do usuário.", "error");
            return;
        }

        if (emprestimos?.length) {
            mostrarToast("O usuário possui histórico de empréstimos e não pode ser excluído.", "error");
            return;
        }

        const { error } = await supabaseClient.from("usuarios").delete().eq("id", id);
        if (error) {
            console.error("Erro ao excluir usuário:", error);
            mostrarToast("Não foi possível excluir o usuário.", "error");
            return;
        }

        mostrarToast("Usuário excluído.", "success");
        await carregarUsuarios();
    });
}

// =====================================================
// EMPRÉSTIMOS
// =====================================================

async function carregarEmprestimos() {
    mostrarMensagem("listaEmprestimos", "Carregando histórico...");

    const { data, error } = await supabaseClient
        .from("emprestimos")
        .select(`
            id,
            livro_id,
            usuario_id,
            data_emprestimo,
            data_devolucao,
            devolvido,
            livros (titulo, autor),
            usuarios (nome, email)
        `)
        .order("data_emprestimo", { ascending: false });

    if (error) {
        console.error("Erro ao carregar empréstimos:", error);
        $("listaEmprestimos").innerHTML = `<div class="error-state"><div><strong>Não foi possível carregar o histórico.</strong><p>${escaparHtml(erroDoSupabase(error))}</p></div></div>`;
        mostrarToast("Falha ao carregar os empréstimos.", "error");
        return;
    }

    estado.emprestimos = data || [];
    renderizarEmprestimos();
    atualizarIndicadores();
}

function renderizarEmprestimos() {
    const termo = estado.buscaEmprestimos.trim().toLocaleLowerCase("pt-BR");
    const emprestimos = estado.emprestimos.filter((item) => {
        const titulo = String(item.livros?.titulo || "").toLocaleLowerCase("pt-BR");
        const usuario = String(item.usuarios?.nome || "").toLocaleLowerCase("pt-BR");
        return !termo || titulo.includes(termo) || usuario.includes(termo);
    });

    $("emprestimosResumo").textContent = `${emprestimos.length} ${emprestimos.length === 1 ? "registro" : "registros"}`;

    if (!emprestimos.length) {
        mostrarEstadoVazio(
            "listaEmprestimos",
            estado.emprestimos.length ? "Nenhum empréstimo encontrado." : "Nenhum empréstimo registrado ainda.",
            estado.emprestimos.length ? "Tente alterar o termo de busca." : "Os novos registros aparecerão aqui."
        );
        return;
    }

    $("listaEmprestimos").innerHTML = emprestimos.map((item) => {
        const devolvido = item.devolvido === true;
        const titulo = item.livros?.titulo || "Livro não encontrado";
        const autor = item.livros?.autor || "Autor não informado";
        const usuario = item.usuarios?.nome || "Usuário não encontrado";

        return `
            <article class="card">
                <div class="card-top">
                    <div class="card-main">
                        <h4 class="card-title" title="${escaparHtml(titulo)}">${escaparHtml(titulo)}</h4>
                        <p class="card-meta"><strong>Autor:</strong> ${escaparHtml(autor)}</p>
                        <p class="card-meta"><strong>Usuário:</strong> ${escaparHtml(usuario)}</p>
                    </div>
                    <span class="status ${devolvido ? "returned" : "borrowed"}">${devolvido ? "Devolvido" : "Em aberto"}</span>
                </div>
                <div class="card-actions">
                    <div>
                        <p class="card-note"><strong>Empréstimo:</strong> ${formatarData(item.data_emprestimo)}</p>
                        <p class="card-note"><strong>Devolução:</strong> ${item.data_devolucao ? formatarData(item.data_devolucao) : "Ainda não devolvido"}</p>
                    </div>
                    ${devolvido ? "" : `<button class="return-button" type="button" data-action="return-loan" data-id="${Number(item.id)}" data-book-id="${Number(item.livro_id)}">Registrar devolução</button>`}
                </div>
            </article>
        `;
    }).join("");
}

async function registrarEmprestimo(event) {
    event.preventDefault();
    const formulario = event.currentTarget;
    const livroId = Number($("livroEmprestimo").value);
    const usuarioId = Number($("usuarioEmprestimo").value);

    if (!livroId || !usuarioId) {
        mostrarToast("Selecione o livro e o usuário.", "error");
        return;
    }

    setBotaoCarregando(formulario, true);

    const { data: livro, error: erroLivro } = await supabaseClient
        .from("livros")
        .select("id, titulo, disponivel")
        .eq("id", livroId)
        .single();

    if (erroLivro || !livro) {
        setBotaoCarregando(formulario, false);
        mostrarToast("Livro não encontrado.", "error");
        return;
    }

    if (!livro.disponivel) {
        setBotaoCarregando(formulario, false);
        mostrarToast("Este livro já está emprestado.", "error");
        await carregarLivros();
        return;
    }

    const { data: usuario, error: erroUsuario } = await supabaseClient
        .from("usuarios")
        .select("id")
        .eq("id", usuarioId)
        .single();

    if (erroUsuario || !usuario) {
        setBotaoCarregando(formulario, false);
        mostrarToast("Usuário não encontrado.", "error");
        return;
    }

    const { error: erroEmprestimo } = await supabaseClient
        .from("emprestimos")
        .insert({
            livro_id: livroId,
            usuario_id: usuarioId,
            data_emprestimo: new Date().toISOString().split("T")[0],
            devolvido: false
        });

    if (erroEmprestimo) {
        setBotaoCarregando(formulario, false);
        console.error("Erro ao registrar empréstimo:", erroEmprestimo);
        mostrarToast("Não foi possível registrar o empréstimo.", "error");
        return;
    }

    const { error: erroAtualizacao } = await supabaseClient
        .from("livros")
        .update({ disponivel: false })
        .eq("id", livroId);

    setBotaoCarregando(formulario, false);

    if (erroAtualizacao) {
        console.error("Erro ao atualizar disponibilidade:", erroAtualizacao);
        mostrarToast("O empréstimo foi registrado, mas a disponibilidade do livro não foi atualizada.", "error");
        await Promise.all([carregarLivros(), carregarEmprestimos()]);
        return;
    }

    formulario.reset();
    mostrarToast("Empréstimo registrado com sucesso.", "success");
    await Promise.all([carregarLivros(), carregarEmprestimos()]);
}

async function devolverLivro(emprestimoId, livroId) {
    const registro = estado.emprestimos.find((item) => Number(item.id) === Number(emprestimoId));
    if (!registro) return;

    pedirConfirmacao(`Registrar a devolução de “${registro.livros?.titulo || "este livro"}”?`, async () => {
        const hoje = new Date().toISOString().split("T")[0];

        const { error: erroEmprestimo } = await supabaseClient
            .from("emprestimos")
            .update({ devolvido: true, data_devolucao: hoje })
            .eq("id", emprestimoId);

        if (erroEmprestimo) {
            console.error("Erro ao registrar devolução:", erroEmprestimo);
            mostrarToast("Não foi possível registrar a devolução.", "error");
            return;
        }

        const { error: erroLivro } = await supabaseClient
            .from("livros")
            .update({ disponivel: true })
            .eq("id", livroId);

        if (erroLivro) {
            console.error("Erro ao atualizar livro:", erroLivro);
            mostrarToast("A devolução foi registrada, mas o livro não foi liberado.", "error");
            await carregarEmprestimos();
            return;
        }

        mostrarToast("Devolução registrada com sucesso.", "success");
        await Promise.all([carregarLivros(), carregarEmprestimos()]);
    });
}

// Compatibilidade para chamadas antigas no HTML.
window.excluirLivro = excluirLivro;
window.excluirUsuario = excluirUsuario;
window.devolverLivro = devolverLivro;

// =====================================================
// EVENTOS
// =====================================================

function configurarEventos() {
    $$(".nav-item").forEach((botao) => {
        botao.addEventListener("click", () => mostrarSecao(botao.dataset.section));
    });

    $$(".quick-btn").forEach((botao) => {
        botao.addEventListener("click", () => mostrarSecao(botao.dataset.section, botao.dataset.focus));
    });

    $$("[data-refresh]").forEach((botao) => {
        botao.addEventListener("click", () => {
            const tipo = botao.dataset.refresh;
            if (tipo === "livros") carregarLivros();
            if (tipo === "usuarios") carregarUsuarios();
            if (tipo === "emprestimos") carregarEmprestimos();
        });
    });

    $("refreshAll").addEventListener("click", () => carregarTudo(true));
    $("mobileMenu").addEventListener("click", abrirMenuMobile);
    $("mobileOverlay").addEventListener("click", fecharMenuMobile);

    $("buscarLivros").addEventListener("input", (event) => {
        estado.buscaLivros = event.target.value;
        renderizarLivros();
    });
    $("buscarUsuarios").addEventListener("input", (event) => {
        estado.buscaUsuarios = event.target.value;
        renderizarUsuarios();
    });
    $("buscarEmprestimos").addEventListener("input", (event) => {
        estado.buscaEmprestimos = event.target.value;
        renderizarEmprestimos();
    });

    $("formLivro").addEventListener("submit", salvarLivro);
    $("formUsuario").addEventListener("submit", salvarUsuario);
    $("formEmprestimo").addEventListener("submit", registrarEmprestimo);

    document.addEventListener("click", (event) => {
        const alvo = event.target.closest("[data-action]");
        if (!alvo) return;
        const id = Number(alvo.dataset.id);
        if (alvo.dataset.action === "delete-book") excluirLivro(id);
        if (alvo.dataset.action === "delete-user") excluirUsuario(id);
        if (alvo.dataset.action === "return-loan") devolverLivro(id, Number(alvo.dataset.bookId));
    });

    $("modalCancel").addEventListener("click", fecharConfirmacao);
    $("modalConfirm").addEventListener("click", async () => {
        const callback = estado.confirmarCallback;
        fecharConfirmacao();
        if (callback) await callback();
    });

    $("confirmModal").addEventListener("click", (event) => {
        if (event.target === $("confirmModal")) fecharConfirmacao();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            fecharConfirmacao();
            fecharMenuMobile();
        }
    });
}

async function carregarTudo(mostrarFeedback = false) {
    if (mostrarFeedback) mostrarToast("Atualizando dados...", "info");
    await Promise.all([carregarLivros(), carregarUsuarios(), carregarEmprestimos()]);
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================

async function inicializar() {
    $("todayLabel").textContent = dataDeHoje();
    configurarEventos();
    mostrarSecao("livros");
    atualizarIndicadores();
    await carregarTudo();
}

inicializar().catch((error) => {
    console.error("Erro na inicialização:", error);
    mostrarToast("Não foi possível iniciar o painel.", "error");
});
