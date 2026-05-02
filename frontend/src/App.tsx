import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from "react";
import { signTransaction } from "@stellar/freighter-api";
import { useFreighter } from "./hooks/useFreighter";
import styles from "./App.module.css";

type TaskStatus = "assigned" | "submitted" | "paid";
type Role = "landing" | "parent" | "child";

interface Child {
  id: string;
  name: string;
  walletAddress: string;
  balance: string;
  fundingTxHash?: string;
}

interface Task {
  id: string;
  childId: string;
  childName: string;
  title: string;
  rewardXlm: string;
  dueDate: string;
  status: TaskStatus;
  proof: string;
  txHash: string | null;
  escrowTxHash?: string;
  onchainTaskId?: string;
  createdAt: string;
}

interface Payment {
  id: string;
  taskId: string;
  childName: string;
  amount: string;
  txHash: string;
  createdAt: string;
}

interface Dashboard {
  parent: {
    name: string;
    walletAddress: string | null;
  };
  treasuryBalance: string;
  children: Child[];
  tasks: Task[];
  payments: Payment[];
}

const emptyDashboard: Dashboard = {
  parent: { name: "Demo Ebeveyn", walletAddress: null },
  treasuryBalance: "0.0000000",
  children: [],
  tasks: [],
  payments: [],
};

const statusLabels: Record<TaskStatus, string> = {
  assigned: "Cocuga atandi",
  submitted: "Onay bekliyor",
  paid: "Odendi",
};

export default function App() {
  const wallet = useFreighter();
  const [role, setRole] = useState<Role>("landing");
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [childName, setChildName] = useState("Fatma");
  const [childWalletAddress, setChildWalletAddress] = useState("");
  const [taskTitle, setTaskTitle] = useState("20 dakika kitap oku");
  const [rewardXlm, setRewardXlm] = useState("5");
  const [dueDate, setDueDate] = useState("");
  const [proofByTask, setProofByTask] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");

  const selectedChild = useMemo(
    () => dashboard.children.find((child) => child.id === selectedChildId),
    [dashboard.children, selectedChildId],
  );

  const selectedChildTasks = useMemo(
    () => dashboard.tasks.filter((task) => task.childId === selectedChildId),
    [dashboard.tasks, selectedChildId],
  );

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const selectedChildExists = dashboard.children.some(
      (child) => child.id === selectedChildId,
    );

    if (dashboard.children.length === 0) {
      setSelectedChildId("");
      return;
    }

    if (!selectedChildId || !selectedChildExists) {
      setSelectedChildId(dashboard.children[0].id);
    }
  }, [dashboard.children, selectedChildId]);

  async function loadDashboard() {
    setError("");
    try {
      const data = await api<Dashboard>("/api/dashboard");
      setDashboard(data);
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setLoading(false);
    }
  }

  async function createChild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction("child", async () => {
      const result = await api<{ child: Child }>("/api/children", {
        method: "POST",
        body: JSON.stringify({ name: childName, walletAddress: childWalletAddress }),
      });
      setChildName("");
      setChildWalletAddress("");
      setSelectedChildId(result.child.id);
      await loadDashboard();
    });
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveTask();
  }

  async function saveTask() {
    const childId = selectedChildId || dashboard.children[0]?.id;

    if (!childId) {
      setError("Once cocuk cüzdani ac, sonra gorev verebilirsin.");
      return;
    }

    const sourceAddress = wallet.address;
    if (!sourceAddress) {
      setError("Akilli kontratta odulu kilitlemek icin once ebeveyn cuzdani baglanmali.");
      return;
    }

    await runAction("task", async () => {
      const escrow = await api<{ draftId: string; xdr: string; networkPassphrase: string }>(
        "/api/tasks/escrow-xdr",
        {
          method: "POST",
          body: JSON.stringify({
            childId,
            title: taskTitle,
            rewardXlm,
            dueDate,
            sourceAddress,
          }),
        },
      );

      const { signedTxXdr, error } = await signTransaction(escrow.xdr, {
        networkPassphrase: escrow.networkPassphrase,
      });

      if (error || !signedTxXdr) {
        throw new Error(error || "Kontrat gorev imzasi alinamadi.");
      }

      await api("/api/tasks/submit-escrow", {
        method: "POST",
        body: JSON.stringify({ draftId: escrow.draftId, signedXdr: signedTxXdr }),
      });
      setSelectedChildId(childId);
      setTaskTitle("");
      setRewardXlm("5");
      setDueDate("");
      await loadDashboard();
    });
  }

  async function submitTask(taskId: string) {
    await runAction(`submit-${taskId}`, async () => {
      await api(`/api/tasks/${taskId}/submit`, {
        method: "POST",
        body: JSON.stringify({ proof: proofByTask[taskId] }),
      });
      await loadDashboard();
    });
  }

  async function approveTask(taskId: string) {
    const task = dashboard.tasks.find((item) => item.id === taskId);
    if (!task) {
      setError("Görev bulunamadı.");
      return;
    }

    const child = dashboard.children.find((item) => item.id === task.childId);
    if (!child) {
      setError("Görevle ilişkili çocuk bulunamadı.");
      return;
    }

    const sourceAddress = wallet.address;
    if (!sourceAddress) {
      setError("Önce ebeveyn cüzdanını bağla, sonra harçlık gönderebilirsin.");
      return;
    }

    await runAction(`approve-${taskId}`, async () => {
      const payment = await api<{ xdr: string; networkPassphrase: string }>(
        `/api/tasks/${taskId}/payment-xdr`,
        {
          method: "POST",
          body: JSON.stringify({ sourceAddress }),
        },
      );

      const { signedTxXdr, error } = await signTransaction(payment.xdr, {
        networkPassphrase: payment.networkPassphrase,
      });

      if (error || !signedTxXdr) {
        throw new Error(error || "Freighter transaction imzası alınamadı.");
      }

      await api(`/api/tasks/${taskId}/submit-payment`, {
        method: "POST",
        body: JSON.stringify({ signedXdr: signedTxXdr }),
      });
      await loadDashboard();
    });
  }

  async function fundTestnetWallet(address: string | null, label: string) {
    if (!address) {
      setError(`${label} cüzdan adresi yok.`);
      return;
    }

    await runAction(`fund-${label}`, async () => {
      await api("/api/friendbot", {
        method: "POST",
        body: JSON.stringify({ address }),
      });
      await loadDashboard();
    });
  }

  async function runAction(label: string, action: () => Promise<void>) {
    setBusyAction(label);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Stellar Testnet aile harcligi</p>
          <h1>KidQuest Wallet</h1>
        </div>
        <div className={styles.headerActions}>
          {role !== "landing" && (
            <button className={styles.iconButton} onClick={() => setRole("landing")} type="button">
              Rol degistir
            </button>
          )}
          <div className={styles.networkPill}>
            <span className={styles.pulse} />
            Testnet
          </div>
          {role === "parent" && (
            <button
              className={wallet.address ? styles.walletConnected : styles.walletButton}
              onClick={wallet.address ? wallet.disconnect : wallet.connect}
              disabled={wallet.status === "connecting"}
              type="button"
            >
              {wallet.status === "connecting"
                ? "Freighter aciliyor"
                : wallet.address
                  ? shortAddress(wallet.address)
                  : "Freighter bagla"}
            </button>
          )}
        </div>
      </header>

      <main className={styles.main}>
        {error && <div className={styles.errorBanner}>{error}</div>}
        {wallet.error && <div className={styles.errorBanner}>{wallet.error}</div>}

        {role === "landing" && (
          <RoleLanding
            childCount={dashboard.children.length}
            taskCount={dashboard.tasks.filter((task) => task.status !== "paid").length}
            onSelectRole={setRole}
          />
        )}

        {role === "parent" && (
          <ParentView
            approveTask={approveTask}
            busyAction={busyAction}
            childName={childName}
            childWalletAddress={childWalletAddress}
            createChild={createChild}
            createTask={createTask}
            dashboard={dashboard}
            dueDate={dueDate}
            loadDashboard={loadDashboard}
            loading={loading}
            rewardXlm={rewardXlm}
            selectedChild={selectedChild}
            selectedChildId={selectedChildId}
            setChildName={setChildName}
            setChildWalletAddress={setChildWalletAddress}
            setDueDate={setDueDate}
            setRewardXlm={setRewardXlm}
            setSelectedChildId={setSelectedChildId}
            setTaskTitle={setTaskTitle}
            taskTitle={taskTitle}
            wallet={wallet}
            fundTestnetWallet={fundTestnetWallet}
          />
        )}

        {role === "child" && (
          <ChildView
            busyAction={busyAction}
            dashboard={dashboard}
            proofByTask={proofByTask}
            selectedChild={selectedChild}
            selectedChildId={selectedChildId}
            selectedChildTasks={selectedChildTasks}
            setProofByTask={setProofByTask}
            setSelectedChildId={setSelectedChildId}
            submitTask={submitTask}
          />
        )}
      </main>
    </div>
  );
}

function RoleLanding({
  childCount,
  onSelectRole,
  taskCount,
}: {
  childCount: number;
  onSelectRole: (role: Role) => void;
  taskCount: number;
}) {
  return (
    <section className={styles.roleLanding}>
      <div className={styles.roleIntro}>
        <p className={styles.kicker}>Aile harcligi ve gorev odulu</p>
        <h2>Bugun uygulamayi kim kullaniyor?</h2>
      </div>
      <div className={styles.roleGrid}>
        <button className={styles.roleCard} onClick={() => onSelectRole("parent")} type="button">
          <div className={`${styles.rolePhoto} ${styles.parentPhoto}`} />
          <span>Ebeveyn</span>
          <strong>Aile paneli</strong>
          <small>{childCount} cocuk cuzdani</small>
        </button>
        <button className={styles.roleCard} onClick={() => onSelectRole("child")} type="button">
          <div className={`${styles.rolePhoto} ${styles.childPhoto}`} />
          <span>Cocuk</span>
          <strong>Gorevlerim</strong>
          <small>{taskCount} acik gorev</small>
        </button>
      </div>
    </section>
  );
}

function ParentView({
  approveTask,
  busyAction,
  childName,
  childWalletAddress,
  createChild,
  createTask,
  dashboard,
  dueDate,
  loadDashboard,
  loading,
  rewardXlm,
  selectedChild,
  selectedChildId,
  setChildName,
  setChildWalletAddress,
  setDueDate,
  setRewardXlm,
  setSelectedChildId,
  setTaskTitle,
  taskTitle,
  wallet,
  fundTestnetWallet,
}: {
  approveTask: (taskId: string) => Promise<void>;
  busyAction: string;
  childName: string;
  childWalletAddress: string;
  createChild: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  createTask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  dashboard: Dashboard;
  dueDate: string;
  loadDashboard: () => Promise<void>;
  loading: boolean;
  rewardXlm: string;
  selectedChild: Child | undefined;
  selectedChildId: string;
  setChildName: (value: string) => void;
  setChildWalletAddress: (value: string) => void;
  setDueDate: (value: string) => void;
  setRewardXlm: (value: string) => void;
  setSelectedChildId: (value: string) => void;
  setTaskTitle: (value: string) => void;
  taskTitle: string;
  wallet: ReturnType<typeof useFreighter>;
  fundTestnetWallet: (address: string | null, label: string) => Promise<void>;
}) {
  const selectedTasks = dashboard.tasks.filter((task) => task.childId === selectedChildId);

  return (
    <>
      <section className={styles.summaryGrid}>
        <Metric label="Cocuk cuzdani" value={dashboard.children.length.toString()} />
        <Metric label="Onay bekleyen" value={dashboard.tasks.filter((task) => task.status === "submitted").length.toString()} />
        <Metric label="Odenen odul" value={`${dashboard.payments.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2)} XLM`} />
        <Metric label="Ebeveyn cüzdanı" value={wallet.address ? "Bağlı" : "Yok"} />
      </section>

      <section className={styles.walletNotice}>
        <div>
          <strong>Ebeveyn cüzdanı</strong>
          {wallet.address ? (
            <span>Bağlı cüzdan: {shortAddress(wallet.address)}</span>
          ) : (
            <span>Harçlık göndermek için Freighter cüzdanını bağla.</span>
          )}
        </div>
        <button
          className={wallet.address ? styles.walletConnected : styles.walletButton}
          type="button"
          onClick={wallet.address ? wallet.disconnect : wallet.connect}
          disabled={wallet.status === "connecting"}
        >
          {wallet.address
            ? "Cüzdan bağlantısını kes"
            : wallet.status === "connecting"
            ? "Bağlanıyor..."
            : "Ebeveyn cüzdanını bağla"}
        </button>
        {wallet.address && (
          <button
            className={styles.iconButton}
            type="button"
            onClick={() => fundTestnetWallet(wallet.address, "ebeveyn")}
            disabled={busyAction === "fund-ebeveyn"}
          >
            Testnet XLM al
          </button>
        )}
      </section>

      <div className={styles.workspace}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Ebeveyn paneli</p>
              <h2>Cocuklar ve cuzdanlar</h2>
            </div>
            <button className={styles.iconButton} onClick={loadDashboard} disabled={loading || Boolean(busyAction)}>
              Yenile
            </button>
          </div>

          <form className={styles.childAddForm} onSubmit={createChild}>
            <label>
              Cocuk adi
              <input value={childName} onChange={(event) => setChildName(event.target.value)} placeholder="Cocuk adi" />
            </label>
            <label className={styles.wideField}>
              Cocuk Stellar wallet adresi
              <input
                value={childWalletAddress}
                onChange={(event) => setChildWalletAddress(event.target.value)}
                placeholder="G..."
              />
            </label>
            <button disabled={busyAction === "child"}>{busyAction === "child" ? "Ekleniyor" : "Cuzdan ekle"}</button>
          </form>

          <ChildWalletPicker
            childrenList={dashboard.children}
            selectedChildId={selectedChildId}
            setSelectedChildId={setSelectedChildId}
          />

          <form className={styles.taskForm} onSubmit={createTask}>
            <label className={styles.childSelectField}>
              Gorev verilecek cocuk
              <select value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)}>
                {dashboard.children.length === 0 && <option value="">Once cocuk ekle</option>}
                {dashboard.children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.wideField}>
              Gorev
              <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Orn. odani topla" />
            </label>
            <label>
              Odul
              <input min="0.1" step="0.1" type="number" value={rewardXlm} onChange={(event) => setRewardXlm(event.target.value)} />
            </label>
            <label>
              Son tarih
              <input
                inputMode="numeric"
                placeholder="02.05.2026"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
            <button className={styles.primaryTaskButton} type="submit">
              {busyAction === "task" ? "Ekleniyor" : "Gorev ver"}
            </button>
          </form>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Secili cocuk</p>
              <h2>{selectedChild ? `${selectedChild.name} gorevleri` : "Cocuk sec"}</h2>
            </div>
            {selectedChild && <span className={styles.balance}>{Number(selectedChild.balance).toFixed(2)} XLM</span>}
          </div>

          {selectedChild ? (
            <>
              <label className={styles.walletSelector}>
                Cocuk cuzdan sec
                <select value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)}>
                  {dashboard.children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.walletBox}>
                <span>{selectedChild.name} cuzdani</span>
                <code>{shortAddress(selectedChild.walletAddress)}</code>
              </div>
              <button
                className={styles.iconButton}
                type="button"
                onClick={() => fundTestnetWallet(selectedChild.walletAddress, "cocuk")}
                disabled={busyAction === "fund-cocuk"}
              >
                Cocuk cuzdanina Testnet XLM al
              </button>
              <TaskReviewList approveTask={approveTask} busyAction={busyAction} tasks={selectedTasks} />
            </>
          ) : (
            <div className={styles.emptyState}>Cocuk ekleyince burada gorevlerini gorup onaylayabilirsin.</div>
          )}
        </section>
      </div>
    </>
  );
}

function ChildView({
  busyAction,
  dashboard,
  proofByTask,
  selectedChild,
  selectedChildId,
  selectedChildTasks,
  setProofByTask,
  setSelectedChildId,
  submitTask,
}: {
  busyAction: string;
  dashboard: Dashboard;
  proofByTask: Record<string, string>;
  selectedChild: Child | undefined;
  selectedChildId: string;
  selectedChildTasks: Task[];
  setProofByTask: Dispatch<SetStateAction<Record<string, string>>>;
  setSelectedChildId: (value: string) => void;
  submitTask: (taskId: string) => Promise<void>;
}) {
  return (
    <section className={styles.childMode}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>Cocuk modu</p>
            <h2>Gorevlerim</h2>
          </div>
          {selectedChild && <span className={styles.balance}>{Number(selectedChild.balance).toFixed(2)} XLM</span>}
        </div>

        <label className={styles.walletSelector}>
          Hangi cocuksun?
          <select value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)}>
            {dashboard.children.length === 0 && <option value="">Henuz cocuk yok</option>}
            {dashboard.children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </select>
        </label>

        {selectedChild ? (
          <>
            <div className={styles.walletBox}>
              <span>{selectedChild.name} cuzdani</span>
              <code>{shortAddress(selectedChild.walletAddress)}</code>
            </div>
            <ChildTaskList
              busyAction={busyAction}
              proofByTask={proofByTask}
              setProofByTask={setProofByTask}
              submitTask={submitTask}
              tasks={selectedChildTasks}
            />
          </>
        ) : (
          <div className={styles.emptyState}>Ebeveynin once cocuk cuzdani eklemeli.</div>
        )}
      </div>
    </section>
  );
}

function ChildWalletPicker({
  childrenList,
  selectedChildId,
  setSelectedChildId,
}: {
  childrenList: Child[];
  selectedChildId: string;
  setSelectedChildId: (value: string) => void;
}) {
  return (
    <div className={styles.childWalletList}>
      <div className={styles.sectionTitle}>
        <span>Cocuk cuzdanlari</span>
        <strong>{childrenList.length}</strong>
      </div>
      {childrenList.length === 0 ? (
        <div className={styles.emptyState}>Once aileye bir cocuk cuzdani ekle.</div>
      ) : (
        <div className={styles.childWalletGrid}>
          {childrenList.map((child) => (
            <button
              key={child.id}
              className={`${styles.childWalletCard} ${
                child.id === selectedChildId ? styles.activeChildWallet : ""
              }`}
              onClick={() => setSelectedChildId(child.id)}
              type="button"
            >
              <span>{child.name}</span>
              <code>{shortAddress(child.walletAddress)}</code>
              <strong>{Number(child.balance).toFixed(2)} XLM</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskReviewList({
  approveTask,
  busyAction,
  tasks,
}: {
  approveTask: (taskId: string) => Promise<void>;
  busyAction: string;
  tasks: Task[];
}) {
  if (tasks.length === 0) {
    return <div className={styles.emptyState}>Bu cocuk icin henuz gorev yok.</div>;
  }

  return (
    <div className={styles.taskList}>
      {tasks.map((task) => (
        <article key={task.id} className={styles.taskItem}>
          <div>
            <div className={styles.taskTitle}>{task.title}</div>
            <div className={styles.meta}>
              {task.rewardXlm} XLM - {formatDate(task.dueDate)}
            </div>
            {task.proof && <p className={styles.proof}>{task.proof}</p>}
            {task.txHash && (
              <a className={styles.txLink} href={stellarExpertUrl(task.txHash)} target="_blank" rel="noreferrer">
                Islemi Stellar Expert'te ac
              </a>
            )}
          </div>
          <div className={styles.taskActions}>
            <span className={`${styles.status} ${styles[task.status]}`}>{statusLabels[task.status]}</span>
            {task.status === "submitted" && (
              <button onClick={() => approveTask(task.id)} disabled={busyAction === `approve-${task.id}`}>
                {busyAction === `approve-${task.id}` ? "Odeniyor" : "Harclik gonder"}
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function ChildTaskList({
  busyAction,
  proofByTask,
  setProofByTask,
  submitTask,
  tasks,
}: {
  busyAction: string;
  proofByTask: Record<string, string>;
  setProofByTask: Dispatch<SetStateAction<Record<string, string>>>;
  submitTask: (taskId: string) => Promise<void>;
  tasks: Task[];
}) {
  if (tasks.length === 0) {
    return <div className={styles.emptyState}>Henuz sana verilmis gorev yok.</div>;
  }

  return (
    <div className={styles.childTasks}>
      {tasks.map((task) => (
        <article key={task.id} className={styles.childTask}>
          <div className={styles.childTaskTop}>
            <strong>{task.title}</strong>
            <span>{task.rewardXlm} XLM</span>
          </div>
          {task.status === "assigned" ? (
            <div className={styles.submitRow}>
              <input
                value={proofByTask[task.id] ?? ""}
                onChange={(event) => setProofByTask((current) => ({ ...current, [task.id]: event.target.value }))}
                placeholder="Kanit notu: kitabi bitirdim, masami topladim..."
              />
              <button onClick={() => submitTask(task.id)} disabled={busyAction === `submit-${task.id}`}>
                Tamamladim
              </button>
            </div>
          ) : (
            <p className={styles.meta}>{statusLabels[task.status]}</p>
          )}
        </article>
      ))}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Istek basarisiz");
  }

  return data;
}

function messageFromError(err: unknown) {
  return err instanceof Error ? err.message : "Beklenmeyen hata olustu";
}

function formatDate(value: string) {
  if (!value) return "Tarih yok";

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
  }

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[2].padStart(2, "0")}.${slashMatch[1].padStart(2, "0")}.${slashMatch[3]}`;
  }

  return value;
}

function shortAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

function stellarExpertUrl(hash: string) {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}
