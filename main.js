const SUPABASE_URL = "https://gdkvsgfxfelwkirfixfm.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdka3ZzZ2Z4ZmVsd2tpcmZpeGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTA2MTcsImV4cCI6MjA4OTkyNjYxN30.GQ12SdQaUeXBGs8cbDoXvE-5T-SYywARJjN5myQxvds";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let myId,
  myRoom,
  isHost = false,
  myName;

async function joinGame(host) {
  myName = document.getElementById("player-name").value;
  myRoom = document.getElementById("room-id").value;
  isHost = host;

  if (!myName || !myRoom) return alert("Wpisz imię i kod pokoju!");

  if (isHost) {
    await supabase.from("rooms").upsert({ id: myRoom, status: "waiting" });
  }

  const { data } = await supabase
    .from("players")
    .insert([{ name: myName, room_id: myRoom, is_host: isHost }])
    .select();

  myId = data[0].id;
  showLobby();
  setupRealtime();
}

function showLobby() {
  document.getElementById("setup-screen").classList.add("hidden");
  document.getElementById("lobby-screen").classList.remove("hidden");
  document.getElementById("display-room-id").innerText = myRoom;
  if (isHost) document.getElementById("start-btn").classList.remove("hidden");
}

async function setupRealtime() {
  // Słuchaj zmian u graczy
  supabase
    .channel("players-res")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "players" },
      (payload) => {
        fetchPlayers();
      },
    )
    .subscribe();

  // Słuchaj zmian w pokoju (czy gra wystartowała)
  supabase
    .channel("room-res")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "rooms" },
      (payload) => {
        if (payload.new.status === "playing") showWord(payload.new);
      },
    )
    .subscribe();

  fetchPlayers();
}

async function fetchPlayers() {
  const { data } = await supabase
    .from("players")
    .select("name")
    .eq("room_id", myRoom);
  const list = document.getElementById("player-list");
  list.innerHTML = data.map((p) => `<li>${p.name}</li>`).join("");
}

async function startGame() {
  const { data: players } = await supabase
    .from("players")
    .select("id")
    .eq("room_id", myRoom);
  const impostor = players[Math.floor(Math.random() * players.length)].id;

  // Tutaj możesz dodać losowanie z bazy słów, na razie statyczne:
  await supabase
    .from("rooms")
    .update({
      status: "playing",
      word_specific: "Piłka Nożna",
      word_category: "Sport",
      impostor_id: impostor,
    })
    .eq("id", myRoom);
}

function showWord(roomData) {
  document.getElementById("lobby-screen").classList.add("hidden");
  document.getElementById("game-screen").classList.remove("hidden");

  const display = document.getElementById("word-display");
  const hint = document.getElementById("role-hint");

  if (roomData.impostor_id === myId) {
    display.innerText = roomData.word_category;
    hint.innerText = "Jesteś Impostorem! Twoje słowo to ogólna KATEGORIA.";
    display.style.color = "#f44336";
  } else {
    display.innerText = roomData.word_specific;
    hint.innerText = "Jesteś Cywilem. Masz konkretne słowo.";
    display.style.color = "#4caf50";
  }
}
