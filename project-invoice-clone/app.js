const STORAGE_KEY = "video-project-invoice-clone-v1";

const STATUSES = [
  { id: "accepted", label: "受注", color: "#64748b" },
  { id: "editing", label: "編集中", color: "#f3a51d" },
  { id: "review", label: "確認待ち", color: "#6f5cf5" },
  { id: "delivered", label: "納品済み", color: "#21b785" },
];

const EXPENSE_CATEGORIES = ["ソフトウェア", "素材", "外注費", "交通費", "通信費", "備品", "広告費", "その他"];

const seedState = {
  selectedMonth: getCurrentMonthInput(),
  clients: [
    {
      id: "client-kitakore",
      name: "株式会社キタコレ",
      shortName: "キタコレ",
      postal: "105-0013",
      address: "東京都港区浜松町2-2-15 浜松町ダイヤビル2F",
      contact: "",
      email: "",
      registration: "",
    },
    {
      id: "client-techbase",
      name: "TechBase (YouTubeチャンネル)",
      shortName: "TechBase",
      postal: "222-2222",
      address: "愛知県名古屋市名古屋区",
      contact: "編集部",
      email: "team@techbase.example",
      registration: "",
    },
    {
      id: "client-bloom",
      name: "株式会社ブルームメディア",
      shortName: "ブルームメディア",
      postal: "100-0006",
      address: "東京都千代田区有楽町1-1-1",
      contact: "制作担当",
      email: "creative@bloom.example",
      registration: "",
    },
    {
      id: "client-cafe",
      name: "カフェ・ド・ルミエール",
      shortName: "ルミエール",
      postal: "150-0013",
      address: "東京都渋谷区恵比寿2-2-2",
      contact: "店長",
      email: "info@lumiere.example",
      registration: "",
    },
  ],
  issuerProfiles: [
    {
      id: "issuer-hasegawa",
      name: "長谷川貴紀",
      postal: "451-0053",
      address: "愛知県名古屋市西区枇杷島1丁目7-1",
      phone: "090-6469-2516",
      registration: "",
      bankName: "住信SBIネット銀行",
      bankCode: "0038",
      bankBranch: "キウイ支店",
      branchCode: "109",
      bankType: "普通預金",
      bankNumber: "8580887",
      bankHolder: "ハセガワアツキ",
    },
    {
      id: "issuer-test",
      name: "合同会社テスト",
      postal: "222-2222",
      address: "愛知県名古屋市名古屋区",
      phone: "",
      registration: "T123123123",
      bankName: "三井住友銀行",
      bankCode: "",
      bankBranch: "テスト支店",
      branchCode: "",
      bankType: "普通",
      bankNumber: "1234565",
      bankHolder: "ドウガヘンシュウ",
    },
  ],
  itemPresets: [
    {
      id: "item-video-editing",
      name: "動画編集（修正対応含む）",
      unit: "式",
      unitPrice: 25000,
      description: "",
    },
  ],
  projects: [
    {
      id: "p-001",
      clientId: "client-bloom",
      title: "採用ブランディング動画 #03",
      dueDate: "2026-06-28",
      status: "accepted",
      amount: 80000,
      note: "素材リンク: Drive / bloom_recruit_03",
    },
    {
      id: "p-002",
      clientId: "client-cafe",
      title: "夏季限定メニュー紹介リール",
      dueDate: "2026-06-30",
      status: "accepted",
      amount: 27000,
      note: "15秒、縦型、BGM差し替えあり",
    },
    {
      id: "p-003",
      clientId: "client-techbase",
      title: "新型スマホ実機レビュー #58",
      dueDate: "2026-07-02",
      status: "accepted",
      amount: 35000,
      note: "テロップ多め",
    },
    {
      id: "p-004",
      clientId: "client-techbase",
      title: "ガジェット比較企画 前編",
      dueDate: "2026-06-16",
      status: "editing",
      amount: 38000,
      note: "比較表を画面右下に追加",
    },
    {
      id: "p-005",
      clientId: "client-bloom",
      title: "会社紹介ムービー リニューアル",
      dueDate: "2026-06-19",
      status: "editing",
      amount: 65000,
      note: "旧動画の構成をベースに尺を短縮",
    },
    {
      id: "p-006",
      clientId: "client-cafe",
      title: "店舗紹介 ショート動画",
      dueDate: "2026-06-23",
      status: "editing",
      amount: 22000,
      note: "ナレーションなし",
    },
    {
      id: "p-007",
      clientId: "client-techbase",
      title: "開封動画 ワイヤレスイヤホン",
      dueDate: "2026-06-02",
      status: "delivered",
      amount: 30000,
      note: "納品済み",
    },
    {
      id: "p-008",
      clientId: "client-bloom",
      title: "展示会用ループ動画",
      dueDate: "2026-06-04",
      status: "delivered",
      amount: 50000,
      note: "会場ディスプレイ用",
    },
    {
      id: "p-009",
      clientId: "client-cafe",
      title: "新店オープン告知動画",
      dueDate: "2026-06-06",
      status: "delivered",
      amount: 44000,
      note: "SNS用",
    },
    {
      id: "p-010",
      clientId: "client-techbase",
      title: "月間ベストバイ 5月版",
      dueDate: "2026-06-08",
      status: "delivered",
      amount: 35000,
      note: "サムネ用カット含む",
    },
    {
      id: "p-011",
      clientId: "client-techbase",
      title: "視聴者Q&A 6月号",
      dueDate: "2026-06-14",
      status: "delivered",
      amount: 30000,
      note: "質問リスト反映済み",
    },
    {
      id: "p-012",
      clientId: "client-bloom",
      title: "社員インタビュー 第4回",
      dueDate: "2026-06-15",
      status: "delivered",
      amount: 45000,
      note: "字幕チェック済み",
    },
    {
      id: "p-013",
      clientId: "client-cafe",
      title: "バリスタ密着 Vlog",
      dueDate: "2026-06-17",
      status: "delivered",
      amount: 33000,
      note: "店内BGM差し替え",
    },
  ],
  expenses: [
    {
      id: "e-001",
      date: "2026-06-03",
      category: "ソフトウェア",
      title: "クラウドストレージ",
      vendor: "Storage Pro",
      amount: 1280,
      memo: "素材共有用",
    },
    {
      id: "e-002",
      date: "2026-06-08",
      category: "素材",
      title: "BGM・効果音ライセンス",
      vendor: "Audio Market",
      amount: 3300,
      memo: "6月納品分",
    },
    {
      id: "e-003",
      date: "2026-06-12",
      category: "外注費",
      title: "字幕チェック",
      vendor: "校正パートナー",
      amount: 22000,
      memo: "社員インタビュー 第4回",
    },
    {
      id: "e-004",
      date: "2026-06-18",
      category: "交通費",
      title: "撮影移動",
      vendor: "JR",
      amount: 1460,
      memo: "店舗紹介 ショート動画",
    },
  ],
  settings: {
    issuerName: "合同会社テスト",
    issuerPostal: "222-2222",
    issuerAddress: "愛知県名古屋市名古屋区",
    issuerRegistration: "T123123123",
    bankName: "三井住友銀行",
    bankBranch: "テスト支店",
    bankType: "普通",
    bankNumber: "1234565",
    bankHolder: "ドウガヘンシュウ",
    defaultDueDays: 30,
  },
};

let state = loadState();
let draggedProjectId = null;
let toastTimer = null;

const boardEl = document.getElementById("board");
const modalRoot = document.getElementById("modal-root");
const toastEl = document.getElementById("toast");

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("new-project-button").addEventListener("click", () => openProjectModal());
  document.getElementById("clients-button").addEventListener("click", () => openClientModal());
  document.getElementById("items-button").addEventListener("click", () => openItemPresetModal());
  document.getElementById("expenses-button").addEventListener("click", () => openExpenseModal());
  document.getElementById("settings-button").addEventListener("click", () => openSettingsModal());
  document.getElementById("invoice-button").addEventListener("click", () => openInvoiceModal());
  document.getElementById("month-picker").addEventListener("change", (event) => {
    state.selectedMonth = event.target.value || state.selectedMonth;
    saveState();
    render();
  });
  document.getElementById("prev-month-button").addEventListener("click", () => shiftSelectedMonth(-1));
  document.getElementById("next-month-button").addEventListener("click", () => shiftSelectedMonth(1));
  render();
});

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(seedState);
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(seedState),
      ...parsed,
      selectedMonth: parsed.selectedMonth || seedState.selectedMonth,
      clients: mergeById(seedState.clients, parsed.clients),
      issuerProfiles: mergeById(seedState.issuerProfiles, parsed.issuerProfiles),
      itemPresets: mergeById(seedState.itemPresets, parsed.itemPresets),
      projects: Array.isArray(parsed.projects) ? parsed.projects : seedState.projects,
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : seedState.expenses,
      settings: { ...seedState.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return structuredClone(seedState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  renderSummary();
  renderMonthlyMetrics();
  renderBoard();
  refreshIcons();
}

function renderSummary() {
  const monthProjects = getSelectedMonthProjects();
  const activeCount = monthProjects.filter((project) => project.status !== "delivered").length;
  const deliveredCount = monthProjects.filter((project) => project.status === "delivered").length;

  document.getElementById("month-picker").value = state.selectedMonth;
  document.getElementById("active-count").textContent = String(activeCount);
  document.getElementById("delivered-count").textContent = String(deliveredCount);
}

function renderMonthlyMetrics() {
  const monthProjects = getSelectedMonthProjects();
  const revenue = getMonthRevenue(state.selectedMonth);
  const expenses = getMonthExpenses(state.selectedMonth).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  document.getElementById("month-revenue").textContent = formatCurrency(revenue);
  document.getElementById("month-expenses").textContent = formatCurrency(expenses);
  document.getElementById("month-profit").textContent = formatCurrency(revenue - expenses);
  document.getElementById("month-projects").textContent = String(monthProjects.length);
}

function renderBoard() {
  boardEl.innerHTML = STATUSES.map((status) => renderColumn(status)).join("");
  boardEl.querySelectorAll(".deal-card").forEach((card) => {
    card.addEventListener("click", () => openProjectModal(card.dataset.id));
    card.addEventListener("dragstart", (event) => {
      draggedProjectId = card.dataset.id;
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => {
      draggedProjectId = null;
      card.classList.remove("dragging");
      document.querySelectorAll(".dropzone").forEach((zone) => zone.classList.remove("drag-over"));
    });
  });

  boardEl.querySelectorAll(".dropzone").forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("drag-over");
      event.dataTransfer.dropEffect = "move";
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("drag-over");
      if (!draggedProjectId) return;
      const project = state.projects.find((item) => item.id === draggedProjectId);
      if (!project) return;
      project.status = zone.dataset.status;
      saveState();
      render();
      showToast("ステータスを更新しました");
    });
  });
}

function renderColumn(status) {
  const projects = getSelectedMonthProjects().filter((project) => project.status === status.id);
  const cards = projects.length
    ? projects.map((project) => renderProjectCard(project, status)).join("")
    : '<div class="empty-column">案件なし</div>';

  return `
    <section class="column" style="--status:${status.color}">
      <header class="column-header">
        <div class="column-title">
          <span class="status-dot" aria-hidden="true"></span>
          <span>${escapeHtml(status.label)}</span>
        </div>
        <span class="count-pill">${projects.length}</span>
      </header>
      <div class="dropzone" data-status="${status.id}">
        ${cards}
      </div>
    </section>
  `;
}

function renderProjectCard(project, status) {
  const client = getClient(project.clientId);
  const alertClass = project.status === "editing" && isDueSoon(project.dueDate) ? " alert" : "";
  return `
    <button class="deal-card" type="button" draggable="true" data-id="${project.id}" style="--status:${status.color}">
      <div class="client-name">${escapeHtml(client.name)}</div>
      <div class="deal-title">${escapeHtml(project.title)}</div>
      <div class="card-bottom">
        <div class="due-date${alertClass}">納期 ${formatShortDate(project.dueDate)}</div>
        <div class="amount">${formatCurrency(project.amount)}</div>
      </div>
    </button>
  `;
}

function openProjectModal(projectId) {
  const isEditing = Boolean(projectId);
  const project =
    state.projects.find((item) => item.id === projectId) ||
    {
      clientId: state.clients[0]?.id || "",
      title: "",
      dueDate: `${state.selectedMonth}-15`,
      status: "accepted",
      amount: "",
      note: "",
    };

  openModal(`
    <div class="modal">
      ${modalHeader(isEditing ? "案件の編集" : "新規案件")}
      <form class="modal-body" id="project-form">
        <div class="form-grid">
          <div class="field full">
            <label for="project-client">クライアント名</label>
            <select id="project-client" name="clientId" required>
              ${state.clients.map((client) => option(client.id, client.name, project.clientId)).join("")}
            </select>
          </div>
          <div class="field full">
            <label for="project-title">案件名</label>
            <input id="project-title" name="title" value="${escapeAttr(project.title)}" placeholder="例: YouTube 6月分 #12" required />
          </div>
          <div class="field">
            <label for="project-due">納期</label>
            <input id="project-due" name="dueDate" type="date" value="${escapeAttr(project.dueDate)}" required />
          </div>
          <div class="field">
            <label for="project-status">ステータス</label>
            <select id="project-status" name="status">
              ${STATUSES.map((status) => option(status.id, status.label, project.status)).join("")}
            </select>
          </div>
          <div class="field full">
            <label for="project-amount">単価（円）</label>
            <input id="project-amount" name="amount" inputmode="numeric" value="${escapeAttr(project.amount)}" placeholder="例: 30000" required />
          </div>
          <div class="field full">
            <label for="project-note">案件情報（素材リンク・参考動画・指示など自由に）</label>
            <textarea id="project-note" name="note" placeholder="素材リンク:">${escapeHtml(project.note || "")}</textarea>
          </div>
        </div>
        <div class="modal-actions ${isEditing ? "split" : ""}">
          ${isEditing ? '<button class="btn danger" type="button" id="delete-project">削除</button>' : ""}
          <div class="modal-actions">
            <button class="btn" type="button" data-close-modal>キャンセル</button>
            <button class="btn primary" type="submit">保存</button>
          </div>
        </div>
      </form>
    </div>
  `);

  document.getElementById("project-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      clientId: data.clientId,
      title: String(data.title || "").trim(),
      dueDate: data.dueDate,
      status: data.status,
      amount: toNumber(data.amount),
      note: String(data.note || "").trim(),
    };

    if (isEditing) {
      const index = state.projects.findIndex((item) => item.id === projectId);
      state.projects[index] = { ...state.projects[index], ...payload };
      showToast("案件を更新しました");
    } else {
      state.projects.unshift({ id: createId("p"), ...payload });
      showToast("案件を追加しました");
    }
    saveState();
    closeModal();
    render();
  });

  const deleteButton = document.getElementById("delete-project");
  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      if (!confirm("この案件を削除しますか？")) return;
      state.projects = state.projects.filter((item) => item.id !== projectId);
      saveState();
      closeModal();
      render();
      showToast("案件を削除しました");
    });
  }
}

function openClientModal(selectedId = state.clients[0]?.id || "") {
  const selected = getClient(selectedId);
  openModal(`
    <div class="modal wide">
      ${modalHeader("クライアント管理")}
      <div class="modal-body client-manager">
        <div class="client-list">
          ${state.clients.map((client) => `
            <button class="client-tab ${client.id === selected.id ? "active" : ""}" type="button" data-client-id="${client.id}">
              <strong>${escapeHtml(client.name)}</strong>
              <span>${escapeHtml(client.email || "メール未設定")}</span>
            </button>
          `).join("")}
          <button class="btn full" type="button" id="new-client-button">
            <i data-lucide="plus"></i>
            <span>追加</span>
          </button>
        </div>
        <form id="client-form">
          <input type="hidden" name="id" value="${escapeAttr(selected.id)}" />
          <div class="form-grid">
            <div class="field full">
              <label for="client-name">会社名・屋号</label>
              <input id="client-name" name="name" value="${escapeAttr(selected.name)}" required />
            </div>
            <div class="field">
              <label for="client-short">短縮名</label>
              <input id="client-short" name="shortName" value="${escapeAttr(selected.shortName || "")}" />
            </div>
            <div class="field">
              <label for="client-contact">担当者</label>
              <input id="client-contact" name="contact" value="${escapeAttr(selected.contact || "")}" />
            </div>
            <div class="field">
              <label for="client-postal">郵便番号</label>
              <input id="client-postal" name="postal" value="${escapeAttr(selected.postal || "")}" />
            </div>
            <div class="field">
              <label for="client-email">メール</label>
              <input id="client-email" name="email" type="email" value="${escapeAttr(selected.email || "")}" />
            </div>
            <div class="field full">
              <label for="client-address">住所</label>
              <input id="client-address" name="address" value="${escapeAttr(selected.address || "")}" />
            </div>
            <div class="field full">
              <label for="client-registration">登録番号</label>
              <input id="client-registration" name="registration" value="${escapeAttr(selected.registration || "")}" />
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn" type="button" data-close-modal>閉じる</button>
            <button class="btn primary" type="submit">保存</button>
          </div>
        </form>
      </div>
    </div>
  `, "wide");

  modalRoot.querySelectorAll(".client-tab").forEach((button) => {
    button.addEventListener("click", () => openClientModal(button.dataset.clientId));
  });

  document.getElementById("new-client-button").addEventListener("click", () => {
    const id = createId("client");
    state.clients.push({
      id,
      name: "新規クライアント",
      shortName: "",
      postal: "",
      address: "",
      contact: "",
      email: "",
      registration: "",
    });
    saveState();
    openClientModal(id);
  });

  document.getElementById("client-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const index = state.clients.findIndex((client) => client.id === data.id);
    state.clients[index] = {
      id: data.id,
      name: String(data.name || "").trim(),
      shortName: String(data.shortName || "").trim(),
      postal: String(data.postal || "").trim(),
      address: String(data.address || "").trim(),
      contact: String(data.contact || "").trim(),
      email: String(data.email || "").trim(),
      registration: String(data.registration || "").trim(),
    };
    saveState();
    render();
    openClientModal(data.id);
    showToast("クライアントを保存しました");
  });

  refreshIcons();
}

function openItemPresetModal(selectedId = state.itemPresets[0]?.id || "new") {
  const isNew = selectedId === "new";
  const selected = state.itemPresets.find((item) => item.id === selectedId) || {
    id: "",
    name: "",
    unit: "式",
    unitPrice: "",
    description: "",
  };

  openModal(`
    <div class="modal wide">
      ${modalHeader("品目管理")}
      <div class="modal-body client-manager">
        <div class="client-list">
          ${state.itemPresets.map((item) => `
            <button class="client-tab ${item.id === selected.id ? "active" : ""}" type="button" data-item-id="${item.id}">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${formatCurrency(item.unitPrice)} / ${escapeHtml(item.unit || "式")}</span>
            </button>
          `).join("")}
          <button class="btn full" type="button" id="new-item-button">
            <i data-lucide="plus"></i>
            <span>追加</span>
          </button>
        </div>
        <form id="item-preset-form">
          <input type="hidden" name="id" value="${escapeAttr(selected.id)}" />
          <div class="form-grid">
            <div class="field full">
              <label for="item-name">品目名</label>
              <input id="item-name" name="name" value="${escapeAttr(selected.name)}" placeholder="例: 動画編集（修正対応含む）" required />
            </div>
            <div class="field">
              <label for="item-unit">単位</label>
              <input id="item-unit" name="unit" value="${escapeAttr(selected.unit)}" placeholder="例: 式" required />
            </div>
            <div class="field">
              <label for="item-price">単価（円）</label>
              <input id="item-price" name="unitPrice" inputmode="numeric" value="${escapeAttr(selected.unitPrice)}" placeholder="例: 25000" required />
            </div>
            <div class="field full">
              <label for="item-description">摘要</label>
              <textarea id="item-description" name="description">${escapeHtml(selected.description || "")}</textarea>
            </div>
          </div>
          <div class="modal-actions ${isNew ? "" : "split"}">
            ${isNew ? "" : '<button class="btn danger" type="button" id="delete-item-preset">削除</button>'}
            <div class="modal-actions">
              <button class="btn" type="button" data-close-modal>閉じる</button>
              <button class="btn primary" type="submit">保存</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `);

  modalRoot.querySelectorAll("[data-item-id]").forEach((button) => {
    button.addEventListener("click", () => openItemPresetModal(button.dataset.itemId));
  });

  document.getElementById("new-item-button").addEventListener("click", () => openItemPresetModal("new"));

  document.getElementById("item-preset-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      name: String(data.name || "").trim(),
      unit: String(data.unit || "式").trim(),
      unitPrice: toNumber(data.unitPrice),
      description: String(data.description || "").trim(),
    };
    let savedId = data.id;

    if (data.id) {
      const index = state.itemPresets.findIndex((item) => item.id === data.id);
      state.itemPresets[index] = { ...state.itemPresets[index], ...payload };
    } else {
      savedId = createId("item");
      state.itemPresets.push({ id: savedId, ...payload });
    }

    saveState();
    openItemPresetModal(savedId);
    showToast("品目を保存しました");
  });

  const deleteButton = document.getElementById("delete-item-preset");
  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      if (!confirm("この品目を削除しますか？")) return;
      state.itemPresets = state.itemPresets.filter((item) => item.id !== selected.id);
      saveState();
      openItemPresetModal(state.itemPresets[0]?.id || "new");
      showToast("品目を削除しました");
    });
  }

  refreshIcons();
}

function openExpenseModal(selectedExpenseId = "") {
  const expenses = getMonthExpenses(state.selectedMonth).sort((a, b) => a.date.localeCompare(b.date));
  const editing = state.expenses.find((expense) => expense.id === selectedExpenseId);
  const expense = editing || {
    date: `${state.selectedMonth}-01`,
    category: EXPENSE_CATEGORIES[0],
    title: "",
    vendor: "",
    amount: "",
    memo: "",
  };
  const total = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  openModal(`
    <div class="modal wide">
      ${modalHeader("経費管理")}
      <div class="modal-body expense-layout">
        <section>
          <div class="expense-total">
            <span>${formatMonthLabel(state.selectedMonth)} 経費</span>
            <strong>${formatCurrency(total)}</strong>
          </div>
          <div class="expense-list">
            ${expenses.length ? expenses.map((item) => `
              <div class="expense-row ${item.id === selectedExpenseId ? "active" : ""}">
                <div class="expense-date">${formatShortDate(item.date)}</div>
                <div class="expense-main">
                  <strong>${escapeHtml(item.title)}</strong>
                  <span>${escapeHtml(item.category)} / ${escapeHtml(item.vendor || "支払先未設定")}</span>
                </div>
                <div class="expense-amount">${formatCurrency(item.amount)}</div>
                <button class="icon-button" type="button" aria-label="編集" data-edit-expense="${item.id}">
                  <i data-lucide="pencil"></i>
                </button>
                <button class="icon-button" type="button" aria-label="削除" data-delete-expense="${item.id}">
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
            `).join("") : '<div class="empty-column">経費なし</div>'}
          </div>
        </section>
        <form class="expense-form-panel" id="expense-form">
          <input type="hidden" name="id" value="${escapeAttr(editing?.id || "")}" />
          <div class="form-grid">
            <div class="field">
              <label for="expense-date">日付</label>
              <input id="expense-date" name="date" type="date" value="${escapeAttr(expense.date)}" required />
            </div>
            <div class="field">
              <label for="expense-category">カテゴリ</label>
              <select id="expense-category" name="category">
                ${EXPENSE_CATEGORIES.map((category) => option(category, category, expense.category)).join("")}
              </select>
            </div>
            <div class="field full">
              <label for="expense-title">内容</label>
              <input id="expense-title" name="title" value="${escapeAttr(expense.title)}" placeholder="例: BGMライセンス" required />
            </div>
            <div class="field full">
              <label for="expense-vendor">支払先</label>
              <input id="expense-vendor" name="vendor" value="${escapeAttr(expense.vendor || "")}" placeholder="例: Audio Market" />
            </div>
            <div class="field full">
              <label for="expense-amount">金額（円）</label>
              <input id="expense-amount" name="amount" inputmode="numeric" value="${escapeAttr(expense.amount)}" placeholder="例: 3300" required />
            </div>
            <div class="field full">
              <label for="expense-memo">メモ</label>
              <textarea id="expense-memo" name="memo">${escapeHtml(expense.memo || "")}</textarea>
            </div>
          </div>
          <div class="modal-actions split">
            <button class="btn" type="button" id="new-expense-entry">新規</button>
            <div class="modal-actions">
              <button class="btn" type="button" data-close-modal>閉じる</button>
              <button class="btn primary" type="submit">${editing ? "更新" : "追加"}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `);

  modalRoot.querySelectorAll("[data-edit-expense]").forEach((button) => {
    button.addEventListener("click", () => openExpenseModal(button.dataset.editExpense));
  });

  modalRoot.querySelectorAll("[data-delete-expense]").forEach((button) => {
    button.addEventListener("click", () => {
      state.expenses = state.expenses.filter((item) => item.id !== button.dataset.deleteExpense);
      saveState();
      render();
      openExpenseModal();
      showToast("経費を削除しました");
    });
  });

  document.getElementById("new-expense-entry").addEventListener("click", () => openExpenseModal());

  document.getElementById("expense-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      date: data.date,
      category: data.category,
      title: String(data.title || "").trim(),
      vendor: String(data.vendor || "").trim(),
      amount: toNumber(data.amount),
      memo: String(data.memo || "").trim(),
    };

    if (data.id) {
      const index = state.expenses.findIndex((item) => item.id === data.id);
      state.expenses[index] = { ...state.expenses[index], ...payload };
      showToast("経費を更新しました");
    } else {
      state.expenses.unshift({ id: createId("e"), ...payload });
      showToast("経費を追加しました");
    }

    state.selectedMonth = payload.date.slice(0, 7) || state.selectedMonth;
    saveState();
    render();
    openExpenseModal(data.id || "");
  });

  refreshIcons();
}

function openSettingsModal(selectedId = state.issuerProfiles[0]?.id || "new") {
  const isNew = selectedId === "new";
  const issuer = state.issuerProfiles.find((profile) => profile.id === selectedId) || {
    id: "",
    name: "",
    postal: "",
    address: "",
    phone: "",
    registration: "",
    bankName: "",
    bankCode: "",
    bankBranch: "",
    branchCode: "",
    bankType: "普通預金",
    bankNumber: "",
    bankHolder: "",
  };

  openModal(`
    <div class="modal wide">
      ${modalHeader("発行元プロフィール")}
      <div class="modal-body client-manager">
        <div class="client-list">
          ${state.issuerProfiles.map((profile) => `
            <button class="client-tab ${profile.id === issuer.id ? "active" : ""}" type="button" data-issuer-id="${profile.id}">
              <strong>${escapeHtml(profile.name)}</strong>
              <span>${escapeHtml(profile.bankName || "振込先未設定")}</span>
            </button>
          `).join("")}
          <button class="btn full" type="button" id="new-issuer-button">
            <i data-lucide="plus"></i>
            <span>追加</span>
          </button>
        </div>
        <form id="issuer-form">
          <input type="hidden" name="id" value="${escapeAttr(issuer.id)}" />
          <div class="form-grid">
            <div class="field full">
              <label for="issuer-name">発行元名</label>
              <input id="issuer-name" name="name" value="${escapeAttr(issuer.name)}" required />
            </div>
            <div class="field">
              <label for="issuer-postal">郵便番号</label>
              <input id="issuer-postal" name="postal" value="${escapeAttr(issuer.postal)}" />
            </div>
            <div class="field">
              <label for="issuer-phone">電話番号</label>
              <input id="issuer-phone" name="phone" value="${escapeAttr(issuer.phone)}" />
            </div>
            <div class="field full">
              <label for="issuer-address">住所</label>
              <input id="issuer-address" name="address" value="${escapeAttr(issuer.address)}" />
            </div>
            <div class="field full">
              <label for="issuer-reg">登録番号</label>
              <input id="issuer-reg" name="registration" value="${escapeAttr(issuer.registration)}" />
            </div>
            <div class="field">
              <label for="bank-name">銀行名</label>
              <input id="bank-name" name="bankName" value="${escapeAttr(issuer.bankName)}" />
            </div>
            <div class="field">
              <label for="bank-code">金融機関コード</label>
              <input id="bank-code" name="bankCode" value="${escapeAttr(issuer.bankCode)}" />
            </div>
            <div class="field">
              <label for="bank-branch">支店名</label>
              <input id="bank-branch" name="bankBranch" value="${escapeAttr(issuer.bankBranch)}" />
            </div>
            <div class="field">
              <label for="branch-code">支店コード</label>
              <input id="branch-code" name="branchCode" value="${escapeAttr(issuer.branchCode)}" />
            </div>
            <div class="field">
              <label for="bank-type">種別</label>
              <input id="bank-type" name="bankType" value="${escapeAttr(issuer.bankType)}" />
            </div>
            <div class="field">
              <label for="bank-number">口座番号</label>
              <input id="bank-number" name="bankNumber" value="${escapeAttr(issuer.bankNumber)}" />
            </div>
            <div class="field full">
              <label for="bank-holder">口座名義</label>
              <input id="bank-holder" name="bankHolder" value="${escapeAttr(issuer.bankHolder)}" />
            </div>
          </div>
          <div class="modal-actions ${isNew ? "" : "split"}">
            ${isNew ? "" : '<button class="btn danger" type="button" id="delete-issuer">削除</button>'}
            <div class="modal-actions">
              <button class="btn" type="button" data-close-modal>閉じる</button>
              <button class="btn primary" type="submit">保存</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `);

  modalRoot.querySelectorAll("[data-issuer-id]").forEach((button) => {
    button.addEventListener("click", () => openSettingsModal(button.dataset.issuerId));
  });

  document.getElementById("new-issuer-button").addEventListener("click", () => openSettingsModal("new"));

  document.getElementById("issuer-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      name: String(data.name || "").trim(),
      postal: String(data.postal || "").trim(),
      address: String(data.address || "").trim(),
      phone: String(data.phone || "").trim(),
      registration: String(data.registration || "").trim(),
      bankName: String(data.bankName || "").trim(),
      bankCode: String(data.bankCode || "").trim(),
      bankBranch: String(data.bankBranch || "").trim(),
      branchCode: String(data.branchCode || "").trim(),
      bankType: String(data.bankType || "").trim(),
      bankNumber: String(data.bankNumber || "").trim(),
      bankHolder: String(data.bankHolder || "").trim(),
    };
    let savedId = data.id;

    if (data.id) {
      const index = state.issuerProfiles.findIndex((profile) => profile.id === data.id);
      state.issuerProfiles[index] = { ...state.issuerProfiles[index], ...payload };
    } else {
      savedId = createId("issuer");
      state.issuerProfiles.push({ id: savedId, ...payload });
    }

    saveState();
    openSettingsModal(savedId);
    showToast("発行元を保存しました");
  });

  const deleteButton = document.getElementById("delete-issuer");
  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      if (!confirm("この発行元プロフィールを削除しますか？")) return;
      state.issuerProfiles = state.issuerProfiles.filter((profile) => profile.id !== issuer.id);
      saveState();
      openSettingsModal(state.issuerProfiles[0]?.id || "new");
      showToast("発行元を削除しました");
    });
  }

  refreshIcons();
}

function openInvoiceModal() {
  const defaultClient = state.clients.find((client) => client.id === "client-kitakore") || state.clients[0];
  const defaultIssuer = state.issuerProfiles.find((issuer) => issuer.id === "issuer-hasegawa") || state.issuerProfiles[0];
  const draft = {
    targetMonth: state.selectedMonth,
    clientId: defaultClient?.id || "",
    issuerId: defaultIssuer?.id || "",
    issueDate: getTodayInputValue(),
    dueDate: getDefaultPaymentDueDate(state.selectedMonth),
    taxMode: "none",
    withholdingMode: "enabled",
    discountRate: 0,
    invoiceNo: `${state.selectedMonth.replace("-", "")}-01`,
    manualItems: [],
  };

  openModal(`
    <div class="modal wide">
      ${modalHeader("請求書の作成")}
      <div class="modal-body">
        <div class="invoice-controls">
          <div class="field">
            <label for="invoice-month">対象月（納期がこの月＋納品済み案件を集計）</label>
            <input id="invoice-month" data-invoice-field="targetMonth" type="month" value="${draft.targetMonth}" />
          </div>
          <div class="field">
            <label for="invoice-client">クライアント</label>
            <select id="invoice-client" data-invoice-field="clientId">
              ${state.clients.map((client) => option(client.id, client.name, draft.clientId)).join("")}
            </select>
          </div>
          <div class="field">
            <label for="invoice-issuer">発行元</label>
            <select id="invoice-issuer" data-invoice-field="issuerId">
              ${state.issuerProfiles.map((issuer) => option(issuer.id, issuer.name, draft.issuerId)).join("")}
            </select>
          </div>
          <div class="field">
            <label for="invoice-issue">発行日</label>
            <input id="invoice-issue" data-invoice-field="issueDate" type="date" value="${draft.issueDate}" />
          </div>
          <div class="field">
            <label for="invoice-due">支払期限</label>
            <input id="invoice-due" data-invoice-field="dueDate" type="date" value="${draft.dueDate}" />
          </div>
          <div class="field">
            <label for="invoice-tax">税区分</label>
            <select id="invoice-tax" data-invoice-field="taxMode">
              <option value="none" selected>消費税なし</option>
              <option value="external">外税（単価は税抜・消費税10%を加算）</option>
              <option value="internal">内税（単価は税込・税額を内訳表示）</option>
            </select>
          </div>
          <div class="field">
            <label for="invoice-withholding">源泉徴収</label>
            <select id="invoice-withholding" data-invoice-field="withholdingMode">
              <option value="enabled" selected>あり（10.21%）</option>
              <option value="none">なし</option>
            </select>
          </div>
          <div class="field">
            <label for="invoice-discount">値引率（%）</label>
            <input id="invoice-discount" data-invoice-field="discountRate" type="number" min="0" max="100" step="0.01" value="${draft.discountRate}" />
          </div>
          <div class="field">
            <label for="invoice-no">請求書番号</label>
            <input id="invoice-no" data-invoice-field="invoiceNo" value="${draft.invoiceNo}" />
          </div>
          <div class="field full invoice-item-builder">
            <label for="invoice-item-preset">保存品目を追加</label>
            <div class="invoice-item-add">
              <select id="invoice-item-preset">
                ${state.itemPresets.map((item) => option(item.id, `${item.name} / ${formatCurrency(item.unitPrice)}`, "")).join("")}
              </select>
              <input id="invoice-item-quantity" type="number" min="1" step="1" value="1" aria-label="数量" />
              <button class="btn" type="button" id="add-invoice-item">
                <i data-lucide="plus"></i>
                <span>追加</span>
              </button>
            </div>
            <div class="invoice-manual-items" id="invoice-manual-items"></div>
          </div>
        </div>
        <div class="invoice-preview-wrap">
          <div id="invoice-preview"></div>
        </div>
        <div class="modal-actions">
          <button class="btn" type="button" data-close-modal>閉じる</button>
          <button class="btn primary" type="button" id="print-invoice">
            <i data-lucide="printer"></i>
            <span>印刷 / PDF保存</span>
          </button>
        </div>
      </div>
    </div>
  `);

  const previewEl = document.getElementById("invoice-preview");
  const updatePreview = () => {
    previewEl.innerHTML = renderInvoicePaper(draft);
  };
  const renderManualItems = () => {
    const container = document.getElementById("invoice-manual-items");
    container.innerHTML = draft.manualItems.map((item) => `
      <div class="invoice-manual-item">
        <span>${escapeHtml(item.name)}</span>
        <strong>${item.quantity}${escapeHtml(item.unit)} / ${formatCurrency(item.unitPrice * item.quantity)}</strong>
        <button class="icon-button" type="button" aria-label="品目を外す" data-remove-invoice-item="${item.id}">
          <i data-lucide="x"></i>
        </button>
      </div>
    `).join("");
    container.querySelectorAll("[data-remove-invoice-item]").forEach((button) => {
      button.addEventListener("click", () => {
        draft.manualItems = draft.manualItems.filter((item) => item.id !== button.dataset.removeInvoiceItem);
        renderManualItems();
        updatePreview();
      });
    });
    refreshIcons();
  };

  modalRoot.querySelectorAll("[data-invoice-field]").forEach((field) => {
    field.addEventListener("input", () => {
      draft[field.dataset.invoiceField] = field.dataset.invoiceField === "discountRate" ? toNumber(field.value) : field.value;
      updatePreview();
    });
    field.addEventListener("change", () => {
      draft[field.dataset.invoiceField] = field.dataset.invoiceField === "discountRate" ? toNumber(field.value) : field.value;
      updatePreview();
    });
  });

  document.getElementById("add-invoice-item").addEventListener("click", () => {
    const presetId = document.getElementById("invoice-item-preset").value;
    const preset = state.itemPresets.find((item) => item.id === presetId);
    const quantity = Math.max(1, toNumber(document.getElementById("invoice-item-quantity").value));
    if (!preset) return;
    draft.manualItems.push({
      id: createId("line"),
      presetId: preset.id,
      name: preset.name,
      unit: preset.unit || "式",
      unitPrice: Number(preset.unitPrice || 0),
      quantity,
      description: preset.description || "",
    });
    renderManualItems();
    updatePreview();
  });

  document.getElementById("print-invoice").addEventListener("click", () => window.print());
  renderManualItems();
  updatePreview();
  refreshIcons();
}

function renderInvoicePaper(draft) {
  const client = getClient(draft.clientId);
  const issuer = getIssuer(draft.issuerId);
  const projectItems = state.projects
    .filter((project) => (
      project.status === "delivered" &&
      project.clientId === draft.clientId &&
      project.dueDate.startsWith(draft.targetMonth)
    ))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((project) => ({
      id: project.id,
      name: project.title,
      unit: "式",
      unitPrice: Number(project.amount || 0),
      quantity: 1,
      description: "",
    }));
  const items = [...projectItems, ...draft.manualItems];

  const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
  const discountRate = Math.min(100, Math.max(0, Number(draft.discountRate || 0)));
  const discount = Math.floor(subtotal * (discountRate / 100));
  const discountedSubtotal = subtotal - discount;
  const tax = draft.taxMode === "external" ? Math.round(discountedSubtotal * 0.1) : draft.taxMode === "internal" ? Math.round(discountedSubtotal / 11) : 0;
  const withholding = draft.withholdingMode === "enabled" ? calculateWithholding(discountedSubtotal) : 0;
  const totalBeforeWithholding = draft.taxMode === "external" ? discountedSubtotal + tax : discountedSubtotal;
  const total = totalBeforeWithholding - withholding;
  const itemRows = items.length
    ? items.map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}${item.description ? `<br /><small>${escapeHtml(item.description)}</small>` : ""}</td>
        <td>${item.quantity}${escapeHtml(item.unit || "式")}</td>
        <td>${formatCurrency(item.unitPrice)}</td>
        <td>${formatCurrency(item.unitPrice * item.quantity)}</td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="4" style="text-align:center;">品目がありません</td>
      </tr>
    `;

  return `
    <article class="invoice-paper">
      <h2 class="invoice-title">請 求 書</h2>
      <div class="invoice-head">
        <section>
          <div class="recipient-address">〒${escapeHtml(client.postal || "")}<br />${escapeHtml(client.address || "")}</div>
          <p class="recipient">${escapeHtml(client.name)}　御中</p>
          <p class="invoice-message">下記のとおりご請求申し上げます。</p>
          <div class="total-box">
            <span>ご請求金額</span>
            <span>${formatCurrency(total)}${draft.taxMode === "none" ? "" : "（税込）"}</span>
          </div>
          <p class="due-line">お支払期限： ${formatLongDate(draft.dueDate)}</p>
        </section>
        <section class="invoice-meta">
          <div>請求書番号： ${escapeHtml(draft.invoiceNo)}</div>
          <div>発行日： ${formatLongDate(draft.issueDate)}</div>
          <div class="issuer-block">
            <strong>${escapeHtml(issuer.name)}</strong><br />
            〒${escapeHtml(issuer.postal || "")}<br />
            ${escapeHtml(issuer.address || "")}<br />
            ${issuer.phone ? `TEL：${escapeHtml(issuer.phone)}<br />` : ""}
            ${issuer.registration ? `登録番号：${escapeHtml(issuer.registration)}` : ""}
          </div>
        </section>
      </div>

      <table class="invoice-table">
        <thead>
          <tr>
            <th>品目・摘要</th>
            <th>数量</th>
            <th>単価</th>
            <th>金額</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="totals">
        <div class="totals-row"><span>小計</span><span>${formatCurrency(subtotal)}</span></div>
        ${discount > 0 ? `<div class="totals-row"><span>値引（-${discountRate}%）</span><span>-${formatCurrency(discount)}</span></div>` : ""}
        ${discount > 0 ? `<div class="totals-row"><span>値引後小計</span><span>${formatCurrency(discountedSubtotal)}</span></div>` : ""}
        ${draft.taxMode === "external" ? `<div class="totals-row"><span>消費税（10%）</span><span>${formatCurrency(tax)}</span></div>` : ""}
        ${draft.taxMode === "internal" ? `<div class="totals-row"><span>うち消費税（10%）</span><span>${formatCurrency(tax)}</span></div>` : ""}
        ${withholding > 0 ? `<div class="totals-row"><span>源泉徴収</span><span>-${formatCurrency(withholding)}</span></div>` : ""}
        <div class="totals-row"><strong>合計</strong><strong>${formatCurrency(total)}</strong></div>
      </div>

      <div class="invoice-notes">
        振込先
        ${escapeHtml(issuer.bankName)}${issuer.bankCode ? `（金融機関コード：${escapeHtml(issuer.bankCode)}）` : ""}
        ${escapeHtml(issuer.bankBranch)}${issuer.branchCode ? `（支店コード：${escapeHtml(issuer.branchCode)}）` : ""}
        ${escapeHtml(issuer.bankType)}　口座番号：${escapeHtml(issuer.bankNumber)}
        口座名義：${escapeHtml(issuer.bankHolder)}
        ${withholding > 0 ? "\n※源泉徴収額は、消費税を除く報酬額に対して算出しています。" : ""}
      </div>
    </article>
  `;
}

function openModal(content) {
  modalRoot.innerHTML = `<div class="modal-backdrop">${content}</div>`;
  modalRoot.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });
  modalRoot.querySelector(".modal-backdrop").addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-backdrop")) closeModal();
  });
  document.addEventListener("keydown", closeOnEscape);
  refreshIcons();
}

function closeModal() {
  modalRoot.innerHTML = "";
  document.removeEventListener("keydown", closeOnEscape);
}

function closeOnEscape(event) {
  if (event.key === "Escape") closeModal();
}

function modalHeader(title) {
  return `
    <header class="modal-header">
      <h2 class="modal-title">${escapeHtml(title)}</h2>
      <button class="icon-button" type="button" aria-label="閉じる" data-close-modal>
        <i data-lucide="x"></i>
      </button>
    </header>
  `;
}

function getSelectedMonthProjects() {
  return state.projects.filter((project) => getProjectMonth(project) === state.selectedMonth);
}

function getProjectMonth(project) {
  return String(project.dueDate || "").slice(0, 7);
}

function getMonthRevenue(month) {
  return state.projects
    .filter((project) => project.status === "delivered" && getProjectMonth(project) === month)
    .reduce((sum, project) => sum + Number(project.amount || 0), 0);
}

function getMonthExpenses(month) {
  return (state.expenses || []).filter((expense) => String(expense.date || "").startsWith(month));
}

function shiftSelectedMonth(delta) {
  state.selectedMonth = shiftMonth(state.selectedMonth, delta);
  saveState();
  render();
}

function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDefaultPaymentDueDate(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDayOfNextMonth = new Date(year, monthNumber + 1, 0);
  return formatDateInput(lastDayOfNextMonth);
}

function getTodayInputValue() {
  return formatDateInput(new Date());
}

function getCurrentMonthInput() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonthLabel(value) {
  const [year, month] = value.split("-");
  return `${year}年${Number(month)}月`;
}

function mergeById(defaultItems, savedItems) {
  if (!Array.isArray(savedItems)) return structuredClone(defaultItems);
  const savedById = new Map(savedItems.map((item) => [item.id, item]));
  const mergedDefaults = defaultItems.map((item) => ({ ...item, ...(savedById.get(item.id) || {}) }));
  const customItems = savedItems.filter((item) => !defaultItems.some((defaultItem) => defaultItem.id === item.id));
  return [...mergedDefaults, ...customItems];
}

function calculateWithholding(amount) {
  const taxableAmount = Math.max(0, Math.floor(Number(amount || 0)));
  if (taxableAmount <= 1000000) return Math.floor(taxableAmount * 0.1021);
  return 102100 + Math.floor((taxableAmount - 1000000) * 0.2042);
}

function getClient(clientId) {
  return state.clients.find((client) => client.id === clientId) || state.clients[0] || { id: "", name: "未設定" };
}

function getIssuer(issuerId) {
  return state.issuerProfiles.find((issuer) => issuer.id === issuerId) || state.issuerProfiles[0] || {
    id: "",
    name: "未設定",
    postal: "",
    address: "",
    phone: "",
    registration: "",
    bankName: "",
    bankCode: "",
    bankBranch: "",
    branchCode: "",
    bankType: "",
    bankNumber: "",
    bankHolder: "",
  };
}

function option(value, label, selected) {
  return `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatShortDate(value) {
  if (!value) return "未設定";
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatLongDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function isDueSoon(value) {
  if (!value) return false;
  const today = new Date("2026-06-14T00:00:00");
  const due = new Date(`${value}T00:00:00`);
  const diff = (due - today) / 86400000;
  return diff >= 0 && diff <= 4;
}

function toNumber(value) {
  return Number(String(value || "").replace(/[^\d.-]/g, "")) || 0;
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons({
      attrs: {
        "stroke-width": 2,
      },
    });
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add("show");
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}
