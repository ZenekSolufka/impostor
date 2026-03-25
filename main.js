const SUPABASE_URL = "https://gdkvsgfxfelwkirfixfm.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdka3ZzZ2Z4ZmVsd2tpcmZpeGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTA2MTcsImV4cCI6MjA4OTkyNjYxN30.GQ12SdQaUeXBGs8cbDoXvE-5T-SYywARJjN5myQxvds";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let myId,
  myRoom,
  isHost = false,
  myName;

async function joinGame(host) {
  myName = document.getElementById("player-name").value;
  myRoom = document.getElementById("room-id").value;
  const myPassword = document.getElementById("room-password").value; // Pobieramy hasło
  isHost = host;

  if (!myName || !myRoom || !myPassword) {
    return alert("Wypełnij wszystkie pola (imię, kod i hasło)!");
  }

  // Sprawdzamy, czy pokój istnieje i jakie ma hasło
  const { data: existingRoom } = await supabaseClient
    .from("rooms")
    .select("id, password")
    .eq("id", myRoom)
    .single();

  if (isHost) {
    // Jeśli pokój istnieje i ma aktywnych graczy (heartbeat < 30s)
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    const { data: activePlayers } = await supabaseClient
      .from("players")
      .select("id")
      .eq("room_id", myRoom)
      .gt("last_seen", thirtySecondsAgo);

    if (activePlayers && activePlayers.length > 0) {
      return alert("Ten kod pokoju jest już zajęty przez inną aktywną grupę!");
    }

    // Jeśli pokój jest wolny/stary, nadpisujemy go nowym hasłem
    await supabaseClient.from("players").delete().eq("room_id", myRoom);
    await supabaseClient.from("rooms").upsert({
      id: myRoom,
      status: "waiting",
      password: myPassword, // Zapisujemy hasło
    });
  } else {
    // Logika dołączania (Cywil)
    if (!existingRoom) {
      return alert("Taki pokój nie istnieje!");
    }

    if (existingRoom.password !== myPassword) {
      return alert("Błędne hasło do pokoju!");
    }
  }

  // Jeśli hasło jest poprawne, dodajemy gracza
  const { data, error } = await supabaseClient
    .from("players")
    .insert([{ name: myName, room_id: myRoom, is_host: isHost }])
    .select();

  if (error) return console.error(error);
  myId = data[0].id;

  showLobby();
  setupRealtime();
  startHeartbeat();
}

function showLobby() {
  document.getElementById("setup-screen").classList.add("hidden");
  document.getElementById("lobby-screen").classList.remove("hidden");
  document.getElementById("display-room-id").innerText = myRoom;
  if (isHost) document.getElementById("start-btn").classList.remove("hidden");
}

async function setupRealtime() {
  // Słuchaj zmian u graczy
  supabaseClient
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
  supabaseClient
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
  const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();

  // 1. FIZYCZNE USUWANIE: Każdy aktywny gracz usuwa "trupy" z tego pokoju
  await supabaseClient
    .from("players")
    .delete()
    .eq("room_id", myRoom)
    .lt("last_seen", thirtySecondsAgo);

  // 2. POBIERANIE: Teraz pobieramy tylko to, co zostało (żywych)
  const { data } = await supabaseClient
    .from("players")
    .select("name, is_host")
    .eq("room_id", myRoom);

  // Jeśli wszyscy wyszli (w tym host), a Ty nim nie jesteś - wyjdź
  if (data.length === 0 && !isHost) {
    alert("Pokój wygasł.");
    location.reload();
    return;
  }

  const list = document.getElementById("player-list");
  list.innerHTML = data
    .map((p) => `<li>${p.name} ${p.is_host ? "👑" : ""}</li>`)
    .join("");
}
const dictionary = [
  { spec: "Napoleon", cat: "Wyspa" },
  { spec: "Mikołaj Kopernik", cat: "Wstrzymanie" },
  { spec: "Donald Trump", cat: "Mur" },
  { spec: "Elon Musk", cat: "Mars" },
  { spec: "Wiedźmin", cat: "Srebro" },
  { spec: "James Bond", cat: "Wstrząśnięte" },
  { spec: "Pinokio", cat: "Prawda" },
  { spec: "Wenecja", cat: "Gołębie" },
  { spec: "Las Vegas", cat: "Grzech" },
  { spec: "Paryż", cat: "Zapach" },
  { spec: "Polska", cat: "Narzekanie" },
  { spec: "IKEA", cat: "Labirynt" },
  { spec: "Siłownia", cat: "Lustra" },
  { spec: "Cmentarz", cat: "Cisza" },
  { spec: "Keczup", cat: "Frytki" },
  { spec: "Pieniądze", cat: "Szczęście" },
  { spec: "Kawa", cat: "Budzik" },
  { spec: "Telewizor", cat: "Pilot" },
  { spec: "Internet", cat: "Kabel" },
  { spec: "Papier toaletowy", cat: "Rolka" },
  { spec: "Klucze", cat: "Brelok" },
  { spec: "Lustro", cat: "Narcyz" },
  { spec: "Pizza Hawajska", cat: "Kontrowersja" },
  { spec: "Cebula", cat: "Warstwy" },
  { spec: "Cytryna", cat: "Mina" },
  { spec: "Kebab", cat: "Kac" },
  { spec: "Mleko", cat: "Płatki" },
  { spec: "Guma do żucia", cat: "Stół" },
  { spec: "Wigilia", cat: "Prezenty" },
  { spec: "Wesele", cat: "Koperta" },
  { spec: "Szkoła", cat: "Przerwa" },
  { spec: "Facebook", cat: "Inwigilacja" },
  { spec: "Instagram", cat: "Zazdrość" },
  { spec: "TikTok", cat: "Układ taneczny" },
  { spec: "Biedronka", cat: "Paleta" },
  { spec: "Zima", cat: "Sól" },
  { spec: "Deszcz", cat: "Kałuża" },
  { spec: "Urlop", cat: "Paragon" },
  { spec: "Prysznic", cat: "Śpiewanie" },
  { spec: "Robert Lewandowski", cat: "Bezglutenowe" },
  { spec: "Sanah", cat: "Szampan" },
  { spec: "Harry Potter", cat: "Okulary" },
  { spec: "Sherlock Holmes", cat: "Skrzypce" },
  { spec: "Wiedźmin", cat: "Grosz" },
  { spec: "Shrek", cat: "Cebula" },
  { spec: "Batman", cat: "Rodzice" },
  { spec: "Myszka Miki", cat: "Rękawiczki" },
  { spec: "Magda Gessler", cat: "Rzucanie talerzami" },
  { spec: "Krzysztof Kononowicz", cat: "Szkolna" },
  { spec: "Pizza Hawajska", cat: "Zbrodnia" },
  { spec: "Kebab", cat: "Sos łagodny" },
  { spec: "Parówki", cat: "93% mięsa" },
  { spec: "Zupka chińska", cat: "Studia" },
  { spec: "Kawa", cat: "Sernik" },
  { spec: "Herbata", cat: "Babcina szklanka" },
  { spec: "Awokado", cat: "Kredyt hipoteczny" },
  { spec: "Pączek", cat: "Tłusty czwartek" },
  { spec: "Ogórek kiszony", cat: "Woda z ogórków" },
  { spec: "Biedronka", cat: "Paleta w przejściu" },
  { spec: "Żabka", cat: "Hot-dog" },
  { spec: "PKP", cat: "Opóźnienie" },
  { spec: "NFZ", cat: "Kolejka do lekarza" },
  { spec: "Poczta Polska", cat: "Awizo" },
  { spec: "IKEA", cat: "Hot-dog za 2 zł" },
  { spec: "Basen", cat: "Czepek" },
  { spec: "Siłownia", cat: "Poniedziałek" },
  { spec: "Kościół", cat: "Taca" },
  { spec: "Wesele", cat: "Zenek" },
  { spec: "Facebook", cat: "Urodziny znajomych" },
  { spec: "Instagram", cat: "Filtr" },
  { spec: "Tinder", cat: "Przesunięcie w lewo" },
  { spec: "YouTube", cat: "Pomiń reklamę" },
  { spec: "Netflix", cat: "Dzielenie hasła" },
  { spec: "iPhone", cat: "Brak ładowarki w pudełku" },
  { spec: "Twitter (X)", cat: "Kłótnia" },
  { spec: "Siri / Alexa", cat: "Podsłuchiwanie" },
  { spec: "Pieniądze", cat: "Inflacja" },
  { spec: "Lustro", cat: "Siedem lat nieszczęścia" },
  { spec: "Zegar", cat: "Szczęśliwi go nie liczą" },
  { spec: "Deszcz", cat: "Anglia" },
  { spec: "Słońce", cat: "Okulary" },
  { spec: "Klucze", cat: "Dno torebki" },
  { spec: "Pilot", cat: "Baterie" },
  { spec: "Skarpetki", cat: "Sandały" },
  { spec: "Pralka", cat: "Jedna z pary" },
  { spec: "Klocki LEGO", cat: "Ból stopy" },
  { spec: "Warszawa", cat: "Słoiki" },
  { spec: "Kraków", cat: "Smog" },
  { spec: "Wrocław", cat: "Krasnale" },
  { spec: "Gdańsk", cat: "Bursztyn" },
  { spec: "Zakopane", cat: "Krupówki" },
  { spec: "Radom", cat: "Chytra baba" },
  { spec: "Sosnowiec", cat: "Paszport" },
  { spec: "Wigilia", cat: "Ryba w wannie" },
  { spec: "Lany Poniedziałek", cat: "Wiaderko" },
  { spec: "Urlop", cat: "Paragon grozy" },
  { spec: "Kac", cat: "Nigdy więcej nie piję" },
  { spec: "Matura", cat: "Garnitur" },
  { spec: "Sesja", cat: "Kserówki" },
  { spec: "Paragon grozy", cat: "Ryba nad morzem" },
  { spec: "Pasek w TVP", cat: "Propaganda" },
  { spec: "Sąsiad", cat: "Wiertarka w sobotę" },
  { spec: "Komunia", cat: "Zegarek lub rower" },
  { spec: "Andrzej Duda", cat: "Narty" },
  { spec: "Robert Makłowicz", cat: "Koperkowy pies" },
  { spec: "Kraków", cat: "Smocza Jama" },
  { spec: "Warszawa", cat: "Mordor na Domaniewskiej" },
  { spec: "PKP", cat: "Wars" },
  { spec: "ZUS", cat: "Emerytura widmo" },
  { spec: "Budzik", cat: "Drzemka" },
  { spec: "Poniedziałek rano", cat: "Nienawiść" },
  { spec: "Piątek wieczór", cat: "Wolność" },
  { spec: "Wywiadówka", cat: "Strach przed rodzicami" },
  { spec: "Pranie", cat: "Brakująca skarpetka" },
  { spec: "Zmywarka", cat: "Tetris z naczyń" },
  { spec: "Lodówka", cat: "Światło w środku" },
  { spec: "Poduszka", cat: "Zimna strona" },
  { spec: "Klucze", cat: "Są w drugiej kurtce" },
  { spec: "Pilot do TV", cat: "Pod kanapą" },
  { spec: "YouTube Premium", cat: "Brak reklam" },
  { spec: "AdBlock", cat: "Biała lista" },
  { spec: "Wikipedia", cat: "Copy-paste do wypracowania" },
  { spec: "Tinder", cat: "Ghosting" },
  { spec: "Spotify", cat: "Wrapped" },
  { spec: "Netflix", cat: "Are you still watching?" },
  { spec: "Cyberpunk 2077", cat: "Bug" },
  { spec: "Counter-Strike", cat: "Rush B" },
  { spec: "League of Legends", cat: "Toksyczność" },
  { spec: "The Sims", cat: "Zabranie drabinki z basenu" },
  { spec: "Rosół", cat: "Niedziela u babci" },
  { spec: "Sałatka jarzynowa", cat: "Majonez kielecki" },
  { spec: "Pączek", cat: "Lukier na palcach" },
  { spec: "Kawa", cat: "Rozpuszczalna" },
  { spec: "Energetyk", cat: "Serce wali" },
  { spec: "Pierogi", cat: "Lepienie" },
  { spec: "Bigos", cat: "Odgrzewany kilka razy" },
  { spec: "Parówki", cat: "Woda po gotowaniu" },
  { spec: "Chipsy", cat: "Powietrze w paczce" },
  { spec: "Karyna", cat: "Paznokcie hybrydowe" },
  { spec: "Typowy Janusz", cat: "Grill i piwko" },
  { spec: "Student", cat: "Zniżka 51%" },
  { spec: "Programista", cat: "Praca zdalna" },
  { spec: "Influencer", cat: "Kod rabatowy" },
  { spec: "Lekarz", cat: "Pismo nie do odczytania" },
  { spec: "Kierowca BMW", cat: "Brak kierunkowskazu" },
  { spec: "Klocki LEGO", cat: "Instrukcja obsługi" },
  { spec: "IKEA", cat: "Klucz imbusowy" },
  { spec: "Nokia 3310", cat: "Niezniszczalna" },
  { spec: "Crocsy", cat: "Tryb sportowy" },
  { spec: "iPhone", cat: "Zbita szybka" },
  { spec: "Termomiks", cat: "Sekta" },
  { spec: "Siłownia", cat: "Białko" },
  { spec: "Kino", cat: "Szepty za plecami" },
  { spec: "Lotnisko", cat: "Cło" },
  { spec: "Las", cat: "Kleszcz" },
  { spec: "Plaża", cat: "Parawan" },
  { spec: "Góry", cat: "Oscypek na zimno" },
  { spec: "Urząd", cat: "Pieczątka" },
  { spec: "Szpital", cat: "Biały kitel" },
  { spec: "Była dziewczyna", cat: "Blokada na Instagramie" },
  { spec: "Teściowa", cat: "Niedzielny obiad" },
  { spec: "Kurier", cat: "Będę za 5 minut" },
  { spec: "Sąsiad", cat: "Remont u góry" },
  { spec: "Współlokator", cat: "Brudne naczynia" },
  { spec: "Młodsze rodzeństwo", cat: "Skarżenie rodzicom" },
  { spec: "Szef", cat: "ASAP" },
  { spec: "Dyrektor", cat: "Apel na korytarzu" },
  { spec: "Pilot do TV", cat: "Uderzanie w spód" },
  { spec: "Router Wi-Fi", cat: "Odłącz i podłącz" },
  { spec: "Odkurzacz", cat: "Wciągnięta firanka" },
  { spec: "Pralka", cat: "Pożarta skarpetka" },
  { spec: "Lodówka", cat: "Przeterminowany jogurt" },
  { spec: "Szafa", cat: "Nie mam się w co ubrać" },
  { spec: "Lustro", cat: "Gadanie do siebie" },
  { spec: "Kosz na śmieci", cat: "Zawsze pełny" },
  { spec: "Patelnia", cat: "Przywieranie" },
  { spec: "Czajnik", cat: "Kamień na dnie" },
  { spec: "Orlen", cat: "Hot-dog i kawa" },
  { spec: "Biedronka", cat: "Świeżaki" },
  { spec: "Lidl", cat: "Sobota" },
  { spec: "Allegro", cat: "Paczkomat" },
  { spec: "Blik", cat: "Kod 6 cyfr" },
  { spec: "InPost", cat: "Multiskrytka" },
  { spec: "Krupówki", cat: "Biały miś" },
  { spec: "Bałtyk", cat: "Sinice" },
  { spec: "Mazury", cat: "Komary" },
  { spec: "Polsat", cat: "Kevin sam w domu" },
  { spec: "ChatGPT", cat: "Halucynacje" },
  { spec: "Discord", cat: "Powiadomienie @everyone" },
  { spec: "Twitch", cat: "Donejt" },
  { spec: "OnlyFans", cat: "Subskrypcja" },
  { spec: "Kryptowaluty", cat: "Koparka" },
  { spec: "Steam", cat: "Promocja -90%" },
  { spec: "Excel", cat: "Formuły" },
  { spec: "PowerPoint", cat: "Przejście slajdu" },
  { spec: "Kac", cat: "Klin" },
  { spec: "Randka", cat: "Niezręczna cisza" },
  { spec: "Egzamin", cat: "Ściąga w rękawie" },
  { spec: "Siłownia", cat: "Zdjęcie w lustrze" },
  { spec: "Praca zdalna", cat: "Kamerka wyłączona" },
  { spec: "Zakupy", cat: "Zapomniana reklamówka" },
  { spec: "Fryzjer", cat: "Tak, jest super (wcale nie)" },
  { spec: "Dentysta", cat: "Borowanie" },
  { spec: "Skarpetki", cat: "Dziura na palcu" },
  { spec: "Sandały", cat: "Skórzane paski" },
  { spec: "Parasol", cat: "Złamany drut" },
  { spec: "Portfel", cat: "Zdjęcie bliskich" },
  { spec: "Paszport", cat: "Brzydkie zdjęcie" },
  { spec: "Dowód osobisty", cat: "18 lat" },
  { spec: "Karta miejska", cat: "Kontrola biletów" },
  { spec: "Piórnik", cat: "Ściągi" },
  { spec: "Majonez Kielecki", cat: "Ocet" },
  { spec: "Sałatka jarzynowa", cat: "Krojenie w kostkę" },
  { spec: "Pączek", cat: "Nadzienie różane" },
  { spec: "Kebab", cat: "Na cienkim" },
  { spec: "Ziemniaki", cat: "Zostaw, zjedz chociaż mięso" },
  { spec: "Kanapka", cat: "Spadanie masłem do dołu" },
  { spec: "Lody", cat: "Zimny pot" },
  { spec: "Guma do żucia", cat: "Poczęstujesz?" },
];

async function startGame() {
  // 1. Pobierz aktualną listę graczy z pokoju
  const { data: players, error: pError } = await supabaseClient
    .from("players")
    .select("id")
    .eq("room_id", myRoom);

  if (pError || players.length < 3) {
    return alert("Potrzebujecie co najmniej 3 graczy!");
  }

  // 2. Wylosuj nową parę słów i nowego Impostora
  const impostor = players[Math.floor(Math.random() * players.length)].id;
  const set = dictionary[Math.floor(Math.random() * dictionary.length)];

  // 3. Najpierw ustawiamy status na 'resetting' (opcjonalnie),
  // a potem na 'playing' z nowymi danymi.
  // To sprawi, że Realtime 'wyłapie' zmianę i odpali showWord u wszystkich.
  await supabaseClient
    .from("rooms")
    .update({
      status: "playing", // Zostawiamy 'playing', ale zmieniamy ID impostora i słowa
      word_specific: set.spec,
      word_category: set.cat,
      impostor_id: impostor,
    })
    .eq("id", myRoom);
}

async function leaveGame() {
  if (isHost) {
    // Jeśli wychodzi Host, usuwamy wszystkich graczy i pokój
    // Supabase usunie graczy automatycznie, jeśli masz ustawione "On Delete Cascade"
    // w relacjach (Foreign Key), jeśli nie - usuwamy ręcznie:
    await supabaseClient.from("players").delete().eq("room_id", myRoom);
    await supabaseClient.from("rooms").delete().eq("id", myRoom);
  } else {
    // Jeśli wychodzi zwykły gracz, usuwamy tylko jego
    await supabaseClient.from("players").delete().eq("id", myId);
  }
  location.reload(); // Powrót do menu
}

function showWord(roomData) {
  document.getElementById("setup-screen").classList.add("hidden");
  document.getElementById("lobby-screen").classList.add("hidden");
  document.getElementById("game-screen").classList.remove("hidden");

  const display = document.getElementById("word-display");
  const hint = document.getElementById("role-hint");
  const nextBtn = document.getElementById("next-round-btn");

  if (isHost) {
    nextBtn.classList.remove("hidden");
  }

  if (roomData.impostor_id === myId) {
    display.innerText = roomData.word_category; // Pamiętaj: u Ciebie 'cat' to 'word_category'
    hint.innerText = "Jesteś Impostorem! Masz tylko podpowiedź.";
    display.style.color = "#f44336";
  } else {
    display.innerText = roomData.word_specific;
    hint.innerText = "Jesteś Cywilem. To Twoje tajne słowo.";
    display.style.color = "#4caf50";
  }
}
function startHeartbeat() {
  setInterval(async () => {
    if (myId) {
      await supabaseClient
        .from("players")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", myId);
    }
  }, 10000); // Co 10 sekund aktualizujemy czas
}
async function cleanDatabase() {
  // Obliczamy punkt odcięcia: obecny czas minus 60 sekund
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

  // Usuwamy z tabeli wszystkich, którzy nie dali znaku życia od minuty
  const { error } = await supabaseClient
    .from("players")
    .delete()
    .lt("last_seen", oneMinuteAgo);

  if (error) console.error("Błąd podczas sprzątania bazy:", error);
}

// Uruchamiamy sprzątanie co 5 sekund (sprawdzanie co 1s jest zbyt obciążające dla darmowego limitu Supabase)
setInterval(cleanDatabase, 5000);
async function cleanEmptyRooms() {
  // 1. Pobierz wszystkie ID pokoi
  const { data: rooms } = await supabaseClient.from("rooms").select("id");

  if (!rooms || rooms.length === 0) return;

  // 2. Pobierz unikalne room_id z tabeli players (czyli te pokoje, które są zajęte)
  const { data: activePlayers } = await supabaseClient
    .from("players")
    .select("room_id");
  const occupiedRoomIds = [...new Set(activePlayers.map((p) => p.room_id))];

  // 3. Znajdź pokoje, których NIE MA na liście zajętych
  const emptyRoomIds = rooms
    .map((r) => r.id)
    .filter((id) => !occupiedRoomIds.includes(id));

  // 4. Jeśli są jakieś puste pokoje, usuń je z bazy
  if (emptyRoomIds.length > 0) {
    await supabaseClient.from("rooms").delete().in("id", emptyRoomIds);

    console.log("Usunięto puste pokoje:", emptyRoomIds);
  }
}

// Uruchamiaj co 10 sekund
setInterval(cleanEmptyRooms, 10000);
