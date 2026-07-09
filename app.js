const challenges = [
  {
    text: "Invent a fake scandal involving someone in this group. Keep it harmless, dramatic, and oddly specific.",
    hint: "Best answer wins if everyone can imagine the group chat exploding for exactly seven minutes."
  },
  {
    text: "Everyone submits a ridiculous alibi. Vote for the least convincing one.",
    hint: "The weaker the excuse, the stronger the legacy."
  },
  {
    text: "Who here would accidentally become famous, and for what deeply unnecessary reason?",
    hint: "Aim for specific, affectionate nonsense."
  },
  {
    text: "Pitch the group as a reality show. What is the episode title?",
    hint: "Bonus points for sounding expensive and doomed."
  },
  {
    text: "Name the fake group mascot and explain its single controversial opinion.",
    hint: "A mascot with lore is basically a business plan."
  },
  {
    text: "Everyone invents a terrible group chat feature. Vote for the one that would cause the most drama.",
    hint: "The best answer sounds almost useful, which is how trouble starts."
  },
  {
    text: "Write the first sentence of a fake apology statement from this group.",
    hint: "Keep it dramatic, harmless, and suspiciously polished."
  },
  {
    text: "What tiny inconvenience would absolutely defeat this group on a survival show?",
    hint: "Specificity wins. So does emotional accuracy."
  }
];

let state = {
  groupName: "",
  members: [],
  groupCode: readGroupCode(),
  activeStep: "group",
  challengeIndex: 0,
  answers: [],
  votes: {},
  recap: "",
  syncMode: "Connecting"
};

let selectedPlayer = localStorage.getItem(playerStorageKey()) || "";
let pollTimer;

const elements = {
  roundDay: document.querySelector("#roundDay"),
  roundStatus: document.querySelector("#roundStatus"),
  challengeText: document.querySelector("#challengeText"),
  challengeHint: document.querySelector("#challengeHint"),
  inviteLink: document.querySelector("#inviteLink"),
  copyStatus: document.querySelector("#copyStatus"),
  groupName: document.querySelector("#groupName"),
  memberName: document.querySelector("#memberName"),
  memberList: document.querySelector("#memberList"),
  rosterStatus: document.querySelector("#rosterStatus"),
  answerMember: document.querySelector("#answerMember"),
  answerText: document.querySelector("#answerText"),
  answerStatus: document.querySelector("#answerStatus"),
  answerList: document.querySelector("#answerList"),
  voteMember: document.querySelector("#voteMember"),
  voteStatus: document.querySelector("#voteStatus"),
  voteList: document.querySelector("#voteList"),
  winnerCard: document.querySelector("#winnerCard"),
  recapTone: document.querySelector("#recapTone"),
  recapCard: document.querySelector("#recapCard")
};

document.querySelector("#saveGroupButton").addEventListener("click", saveGroup);
document.querySelector("#addMemberButton").addEventListener("click", addMember);
document.querySelector("#startRoundButton").addEventListener("click", startRound);
document.querySelector("#submitAnswerButton").addEventListener("click", submitAnswer);
document.querySelector("#generateRecapButton").addEventListener("click", generateRecap);
document.querySelector("#copyInviteButton").addEventListener("click", copyInvite);
document.querySelector("#resetButton").addEventListener("click", resetRound);

document.querySelectorAll(".step").forEach((button) => {
  button.addEventListener("click", () => updateGroup({ activeStep: button.dataset.step }));
});

elements.memberName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addMember();
});

elements.groupName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") saveGroup();
});

elements.answerMember.addEventListener("change", () => setSelectedPlayer(elements.answerMember.value));
elements.voteMember.addEventListener("change", () => setSelectedPlayer(elements.voteMember.value));

connect();

function readGroupCode() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("group");
  const stored = localStorage.getItem("chaos-club-group-code");
  const code = (fromUrl || stored || createGroupCode()).toUpperCase();
  localStorage.setItem("chaos-club-group-code", code);
  return code;
}

function playerStorageKey() {
  return `chaos-club-player-${state.groupCode}`;
}

function createGroupCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function connect() {
  await refreshState();
  clearInterval(pollTimer);
  pollTimer = setInterval(refreshState, 1800);
}

async function refreshState() {
  try {
    const response = await fetch(`/api/state?group=${encodeURIComponent(state.groupCode)}`);
    if (!response.ok) throw new Error("State request failed");

    const serverState = await response.json();
    state = { ...serverState, syncMode: "Shared backend" };

    if (!state.members.includes(selectedPlayer)) {
      selectedPlayer = state.members[0] || "";
      if (selectedPlayer) localStorage.setItem(playerStorageKey(), selectedPlayer);
    }

    render();
  } catch {
    state.syncMode = "Offline";
    render();
  }
}

async function sendAction(action, payload = {}) {
  const response = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group: state.groupCode, action, payload })
  });

  if (!response.ok) {
    elements.copyStatus.textContent = "The backend did not accept that update. Try again.";
    return;
  }

  state = { ...(await response.json()), syncMode: "Shared backend" };
  render();
}

function setSelectedPlayer(member) {
  selectedPlayer = member;
  if (member) localStorage.setItem(playerStorageKey(), member);
  elements.answerMember.value = member;
  elements.voteMember.value = member;
  renderVotes();
}

function todayLabel() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric"
  }).format(new Date());
}

function currentChallenge() {
  return challenges[state.challengeIndex % challenges.length];
}

function getInviteUrl() {
  return `${window.location.origin}${window.location.pathname}?group=${state.groupCode}`;
}

function saveGroup() {
  updateGroup({ groupName: elements.groupName.value.trim() });
}

function updateGroup(payload) {
  sendAction("update_group", payload);
}

async function copyInvite() {
  const inviteText = `Join ${state.groupName || "my Chaos Club"}: ${getInviteUrl()}`;

  try {
    await navigator.clipboard.writeText(inviteText);
    elements.copyStatus.textContent = "Invite copied. This link opens the shared backend round.";
  } catch {
    elements.inviteLink.select();
    elements.copyStatus.textContent = "Copy the link above and send it to your friends.";
  }
}

function addMember() {
  const name = elements.memberName.value.trim();
  if (!name) return;

  elements.memberName.value = "";
  sendAction("add_member", { name });
}

function removeMember(name) {
  sendAction("remove_member", { name });
}

function startRound() {
  sendAction("start_round");
}

function submitAnswer() {
  const member = elements.answerMember.value;
  const text = elements.answerText.value.trim();

  if (!member || !text) return;

  elements.answerText.value = "";
  sendAction("submit_answer", { member, text });
}

function voteFor(answerMember) {
  const voter = elements.voteMember.value;
  if (!voter || voter === answerMember) return;

  sendAction("vote", { voter, answerMember });
}

function resetRound() {
  sendAction("reset_round");
}

function getVoteCounts() {
  return state.answers.reduce((counts, answer) => {
    counts[answer.member] = Object.values(state.votes).filter((vote) => vote === answer.member).length;
    return counts;
  }, {});
}

function getWinner() {
  const counts = getVoteCounts();
  return [...state.answers].sort((a, b) => (counts[b.member] || 0) - (counts[a.member] || 0))[0];
}

function getAnsweredMembers() {
  return state.answers.map((answer) => answer.member);
}

function getWaitingForAnswers() {
  const answered = getAnsweredMembers();
  return state.members.filter((member) => !answered.includes(member));
}

function getWaitingForVotes() {
  const voters = Object.keys(state.votes);
  return state.answers.map((answer) => answer.member).filter((member) => !voters.includes(member));
}

function generateRecap() {
  const winner = getWinner();
  const counts = getVoteCounts();
  if (!winner) return;

  const group = state.groupName || "the group";
  const votes = counts[winner.member] || 0;
  const tone = elements.recapTone.value;
  const templates = {
    tabloid: `Local sources confirm ${group} has been shaken by ${winner.member}'s winning answer: "${winner.text}" With ${votes} vote${votes === 1 ? "" : "s"}, the group has no choice but to call this art, evidence, or both.`,
    sports: `A stunning performance from ${winner.member} today. The answer, "${winner.text}", moved with confidence, confused the defense, and secured ${votes} vote${votes === 1 ? "" : "s"} in a round analysts are already calling "deeply avoidable."`,
    minutes: `Minutes from ${group}: after careful review and entirely questionable judgment, ${winner.member} was declared today's winner for "${winner.text}" Motion passed with ${votes} vote${votes === 1 ? "" : "s"} and several implied side-eyes.`
  };

  sendAction("generate_recap", { recap: templates[tone] });
}

function render() {
  const challenge = currentChallenge();
  const groupReady = state.groupName || state.members.length > 0;
  const statusMap = {
    group: "Setup",
    answers: "Answer",
    votes: "Vote",
    reveal: "Reveal"
  };

  elements.roundDay.textContent = todayLabel();
  elements.roundStatus.textContent = statusMap[state.activeStep] || "Setup";
  elements.challengeText.textContent = groupReady ? challenge.text : "Create your group to unlock today's chaos.";
  elements.challengeHint.textContent = groupReady ? challenge.hint : "Invite friends, let everyone answer from their own phone, then reveal the damage together.";
  elements.inviteLink.value = getInviteUrl();
  if (document.activeElement !== elements.groupName) {
    elements.groupName.value = state.groupName || "";
  }

  renderSteps();
  renderViews();
  renderMembers();
  renderMemberSelects();
  renderStatuses();
  renderAnswers();
  renderVotes();
  renderReveal();
}

function renderSteps() {
  document.querySelectorAll(".step").forEach((button) => {
    button.classList.toggle("active", button.dataset.step === state.activeStep);
  });
}

function renderViews() {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active-view"));
  document.querySelector(`#${state.activeStep || "group"}View`).classList.add("active-view");
}

function renderMembers() {
  elements.memberList.innerHTML = "";

  state.members.forEach((member) => {
    const pill = document.querySelector("#memberPillTemplate").content.cloneNode(true).querySelector(".pill");
    pill.textContent = `${member} x`;
    pill.setAttribute("aria-label", `Remove ${member}`);
    pill.addEventListener("click", () => removeMember(member));
    elements.memberList.append(pill);
  });
}

function renderMemberSelects() {
  [elements.answerMember, elements.voteMember].forEach((select) => {
    select.innerHTML = state.members.map((member) => `<option value="${escapeHtml(member)}">${escapeHtml(member)}</option>`).join("");
    select.value = state.members.includes(selectedPlayer) ? selectedPlayer : state.members[0] || "";
  });
}

function renderAnswers() {
  elements.answerList.innerHTML = "";

  if (!state.answers.length) {
    elements.answerList.innerHTML = `<div class="answer-card"><strong>No answers yet</strong><p>Waiting for the first brave person to submit from their own phone.</p></div>`;
    return;
  }

  state.answers.forEach((answer) => {
    const card = document.createElement("article");
    card.className = "answer-card";
    card.innerHTML = `<strong>${escapeHtml(answer.member)}</strong><p>Answer locked. It stays hidden until voting closes.</p>`;
    elements.answerList.append(card);
  });
}

function renderVotes() {
  elements.voteList.innerHTML = "";
  const voter = elements.voteMember.value || selectedPlayer || state.members[0];

  if (!state.answers.length) {
    elements.voteList.innerHTML = `<div class="vote-card"><strong>No answers to vote on</strong><p>Get at least two answers first.</p></div>`;
    return;
  }

  state.answers.forEach((answer) => {
    const authorIsVoting = voter === answer.member;
    const card = document.createElement("article");
    const selected = state.votes[voter] === answer.member;
    card.className = `vote-card${selected ? " selected" : ""}${authorIsVoting ? " disabled-card" : ""}`;
    card.innerHTML = `
      <strong>${authorIsVoting ? "Your answer" : "Anonymous answer"}</strong>
      <p>${escapeHtml(answer.text)}</p>
      <button class="vote-button" type="button" ${authorIsVoting ? "disabled" : ""}>${authorIsVoting ? "Can't vote for yourself" : selected ? "Current vote" : "Vote for this"}</button>
    `;
    card.querySelector("button").addEventListener("click", () => voteFor(answer.member));
    elements.voteList.append(card);
  });
}

function renderReveal() {
  const winner = getWinner();
  const counts = getVoteCounts();

  if (!winner) {
    elements.winnerCard.innerHTML = `<p class="eyebrow">Today's winner</p><h2>No winner yet</h2><p>Collect votes to reveal the recap.</p>`;
    elements.recapCard.textContent = state.recap || "The recap will appear here after the reveal.";
    return;
  }

  const voteCount = counts[winner.member] || 0;
  elements.winnerCard.innerHTML = `
    <p class="eyebrow">Today's winner</p>
    <h2>${escapeHtml(winner.member)}</h2>
    <p>${voteCount} vote${voteCount === 1 ? "" : "s"} for: "${escapeHtml(winner.text)}"</p>
  `;
  elements.recapCard.textContent = state.recap || "Choose a recap style and generate the first piece of group lore.";
}

function renderStatuses() {
  const waitingAnswers = getWaitingForAnswers();
  const answered = getAnsweredMembers();
  const waitingVotes = getWaitingForVotes();
  const voted = Object.keys(state.votes);

  elements.rosterStatus.innerHTML = statusItems([
    ["Players", `${state.members.length} joined`],
    ["Code", state.groupCode],
    ["Sync", state.syncMode]
  ]);

  elements.answerStatus.innerHTML = statusItems([
    ["Answered", `${answered.length}/${state.members.length}`],
    ["Waiting on", waitingAnswers.length ? waitingAnswers.join(", ") : "Everyone"],
    ["Question", `#${(state.challengeIndex % challenges.length) + 1}`]
  ]);

  elements.voteStatus.innerHTML = statusItems([
    ["Voted", `${voted.length}/${state.answers.length}`],
    ["Waiting on", waitingVotes.length ? waitingVotes.join(", ") : "Ready to reveal"],
    ["Reveal", voted.length ? "Winner can be shown" : "Need votes"]
  ]);
}

function statusItems(items) {
  return items
    .map(
      ([label, value]) => `
        <div class="status-item">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `
    )
    .join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}
