/* NEXUS data — world definition & fresh-world constructor */
(function () {
  const B = [
    // id, name, type, gx, gy, gw, gh, color, desc
    ["plant",   "Halcyon Assembly Plant", "industry", 16, 1, 5, 3, "#5a6b8c", "The district's biggest employer. Was."],
    ["cityhall","City Hall",              "civic",     8, 1, 3, 2, "#8c7a5a", "Mayor Vasquez's seat of power."],
    ["meridian","Meridian Towers",        "housing",   3, 1, 2, 3, "#4a5878", "Upscale apartments."],
    ["market",  "Kwon's Corner Market",   "shop",      6, 4, 2, 2, "#43a06b", "Groceries, gossip, and Rosa Kwon."],
    ["precinct","Precinct 9",             "civic",    12, 4, 2, 2, "#4f8bff", "Captain Reeves runs a tired house."],
    ["diner",   "Rusty Anchor Diner",     "food",      8, 7, 2, 2, "#d98c3f", "Coffee, eggs, everything overheard."],
    ["clinic",  "Harbor Clinic",          "civic",     4, 7, 2, 2, "#67c8c0", "Dr. Osei patches up the district."],
    ["garage",  "Vale Auto Repair",       "shop",     13, 8, 2, 2, "#b0623f", "Marcus Vale's garage."],
    ["blackline","The Blackline Bar",     "bar",      19, 8, 2, 2, "#8c3a5a", "Dim. Loud. Red Knives territory."],
    ["club",    "Neon Palm",              "bar",      10, 11, 2, 2, "#c94f9c", "Nightclub. Viktor Marsh's palace."],
    ["dockside","Dockside Flats",         "housing",   2, 10, 3, 2, "#48566e", "Workers' apartments. Your place too."],
    ["oldrow",  "Old Row",                "housing",  16, 11, 4, 2, "#565040", "Sagging houses, long memories."],
    ["park",    "Founders Park",          "park",      7, 10, 2, 1, "#3a6e4a", "A bench, a statue, Teddy Voss."],
  ];

  const BUSINESSES = [
    // id, name, buildingId, type, ownerId, cash, price, wage, quality, baseDemand
    { id: "plant",  name: "Halcyon Assembly Plant", building: "plant",  type: "factory", owner: null,     cash: 20000, price: 0,  wage: 34, quality: 5, baseDemand: 0, open: true },
    { id: "market", name: "Kwon's Corner Market",   building: "market", type: "retail",  owner: "rosa",   cash: 3200,  price: 12, wage: 17, quality: 6, baseDemand: 14, open: true },
    { id: "diner",  name: "Rusty Anchor Diner",     building: "diner",  type: "food",    owner: "faith",  cash: 2600,  price: 14, wage: 16, quality: 7, baseDemand: 12, open: true },
    { id: "garage", name: "Vale Auto Repair",       building: "garage", type: "service", owner: "marcus", cash: 1900,  price: 60, wage: 22, quality: 7, baseDemand: 4,  open: true },
    { id: "club",   name: "Neon Palm",              building: "club",   type: "night",   owner: "viktor", cash: 5200,  price: 25, wage: 18, quality: 6, baseDemand: 8,  open: true },
    { id: "blackline", name: "The Blackline Bar",   building: "blackline", type: "night", owner: "oz",   cash: 4100,  price: 15, wage: 15, quality: 4, baseDemand: 6,  open: true },
    { id: "clinic", name: "Harbor Clinic",          building: "clinic", type: "civic",   owner: "amara",  cash: 2000,  price: 40, wage: 26, quality: 8, baseDemand: 3,  open: true },
  ];

  // trait vocab: brave, timid, ambitious, loyal, greedy, kind, violent, cunning, honest, bitter, charming, devout, reckless, patient
  // morality 0..1 (low = criminal-leaning) | temper 0..1 | chattiness 0..1
  const RESIDENTS = [
    // ---- Halcyon plant workers (jobless on Day 1) ----
    { id: "tomas",  name: "Tomas Reyes",    age: 42, job: { biz: "plant", title: "line supervisor" }, home: "oldrow",   money: 900,
      traits: ["patient", "loyal"], morality: .7, temper: .4, chattiness: .5,
      goal: "keep his house on Old Row", fear: "eviction",
      secret: { type: "debt", text: "owes $2,400 in gambling debts to the Red Knives" },
      social: "diner", faction: "workers", lean: "okafor" },
    { id: "priya",  name: "Priya Nair",     age: 29, job: { biz: "plant", title: "machinist" }, home: "dockside", money: 1400,
      traits: ["ambitious", "honest"], morality: .85, temper: .3, chattiness: .6,
      goal: "save for an engineering degree", fear: "being stuck in Rusthook forever",
      secret: null, social: "market", faction: "workers", lean: "okafor" },
    { id: "dequan", name: "Dequan Holt",    age: 35, job: { biz: "plant", title: "forklift driver" }, home: "dockside", money: 500,
      traits: ["brave", "bitter"], morality: .65, temper: .85, chattiness: .8,
      goal: "make somebody answer for the plant", fear: "being ignored",
      secret: null, social: "diner", faction: "workers", lean: "okafor" },
    { id: "greta",  name: "Greta Lindqvist", age: 55, job: { biz: "plant", title: "quality inspector" }, home: "oldrow", money: 2100,
      traits: ["honest", "patient"], morality: .9, temper: .2, chattiness: .35,
      goal: "a quiet retirement", fear: "trouble finding her",
      secret: { type: "knowledge", text: "saw shipping ledgers proving the plant was PROFITABLE the quarter it closed" },
      social: "market", faction: "workers", lean: "undecided" },
    { id: "sam",    name: "Sam Torres",     age: 24, job: { biz: "plant", title: "packer" }, home: "dockside", money: 260,
      traits: ["reckless", "charming"], morality: .35, temper: .6, chattiness: .7,
      goal: "fast money, any money", fear: "prison",
      secret: null, social: "club", faction: "workers", lean: "undecided", partner: "lena" },
    { id: "ana",    name: "Ana Petrova",    age: 31, job: { biz: "plant", title: "welder" }, home: "dockside", money: 700,
      traits: ["kind", "brave"], morality: .8, temper: .5, chattiness: .5,
      goal: "a stable life for her daughter", fear: "losing the apartment",
      secret: null, social: "market", faction: "workers", lean: "okafor" },
    { id: "chuck",  name: "Chuck Beaumont", age: 48, job: { biz: "plant", title: "maintenance" }, home: "oldrow", money: 420,
      traits: ["bitter", "loyal"], morality: .6, temper: .7, chattiness: .6,
      goal: "one more paycheck, then another", fear: "the bottle winning",
      secret: null, social: "blackline", faction: "workers", lean: "okafor" },
    { id: "yusuf",  name: "Yusuf Demir",    age: 38, job: { biz: "plant", title: "shift lead" }, home: "dockside", money: 1100,
      traits: ["devout", "kind", "patient"], morality: .95, temper: .2, chattiness: .6,
      goal: "hold the community together", fear: "his neighbors turning on each other",
      secret: null, social: "park", faction: "workers", lean: "okafor" },
    { id: "lena",   name: "Lena Wojcik",    age: 26, job: { biz: "plant", title: "office clerk" }, home: "dockside", money: 800,
      traits: ["charming", "timid"], morality: .75, temper: .3, chattiness: .8,
      goal: "move in with Sam somewhere better", fear: "Sam doing something stupid",
      secret: { type: "knowledge", text: "typed a memo about a land sale to 'Meridian Development' two weeks before the closure" },
      social: "club", faction: "workers", lean: "undecided", partner: "sam" },

    // ---- business owners & staff ----
    { id: "marcus", name: "Marcus Vale",    age: 31, job: { biz: "garage", title: "owner-mechanic" }, home: "oldrow", money: 4820,
      traits: ["cunning", "loyal"], morality: .55, temper: .5, chattiness: .4,
      goal: "open a bigger repair shop", fear: "losing custody of his daughter",
      secret: { type: "crime", text: "repairs and repaints vehicles for the Red Knives, off the books" },
      social: "diner", faction: "business", lean: "undecided" },
    { id: "rosa",   name: "Rosa Kwon",      age: 58, job: { biz: "market", title: "owner" }, home: "oldrow", money: 3600,
      traits: ["kind", "cunning"], morality: .8, temper: .4, chattiness: .95,
      goal: "keep the market alive and know everything", fear: "the district emptying out",
      secret: null, social: "market", faction: "business", lean: "vasquez" },
    { id: "denny",  name: "Denny Kwon",     age: 27, job: { biz: "market", title: "clerk" }, home: "oldrow", money: 640,
      traits: ["timid", "honest"], morality: .8, temper: .3, chattiness: .5,
      goal: "leave Rusthook without breaking his mother's heart", fear: "telling Rosa",
      secret: { type: "personal", text: "has a paid bus ticket out of the city hidden in a drawer" },
      social: "club", faction: "business", lean: "undecided" },
    { id: "faith",  name: "Faith Adebayo",  age: 44, job: { biz: "diner", title: "owner" }, home: "dockside", money: 2900,
      traits: ["brave", "honest", "patient"], morality: .9, temper: .4, chattiness: .7,
      goal: "run a clean place in a dirty district", fear: "her past on the force catching up",
      secret: { type: "past", text: "left the police force after refusing to bury evidence — the file still exists" },
      social: "diner", faction: "business", lean: "okafor" },
    { id: "milo",   name: "Milo Park",      age: 22, job: { biz: "diner", title: "cook" }, home: "dockside", money: 380,
      traits: ["charming", "reckless"], morality: .7, temper: .3, chattiness: .8,
      goal: "play one real show at the Neon Palm", fear: "being laughed off stage",
      secret: null, social: "club", faction: "workers", lean: "okafor" },
    { id: "sadie",  name: "Sadie Quinn",    age: 33, job: { biz: "diner", title: "server" }, home: "dockside", money: 520,
      traits: ["cunning", "charming"], morality: .45, temper: .4, chattiness: .75,
      goal: "buy her way out of an old debt", fear: "Duke deciding she knows too much",
      secret: { type: "crime", text: "passes what she overhears at the diner to the Red Knives for cash" },
      social: "blackline", faction: "workers", lean: "undecided" },
    { id: "viktor", name: "Viktor Marsh",   age: 39, job: { biz: "club", title: "owner" }, home: "meridian", money: 8200,
      traits: ["greedy", "charming", "cunning"], morality: .3, temper: .5, chattiness: .6,
      goal: "own every lit-up doorway in Rusthook", fear: "an audit",
      secret: { type: "crime", text: "washes Red Knives money through the Neon Palm's books" },
      social: "club", faction: "business", lean: "vasquez" },
    { id: "nikki",  name: "Nikki Cole",     age: 28, job: { biz: "club", title: "bartender" }, home: "dockside", money: 610,
      traits: ["cunning", "brave"], morality: .6, temper: .5, chattiness: .6,
      goal: "leverage — enough to never be scared again", fear: "Viktor noticing what she's copied",
      secret: { type: "knowledge", text: "keeps photos of the Neon Palm's second ledger on a hidden drive" },
      social: "club", faction: "workers", lean: "undecided" },
    { id: "oz",     name: "Oz Delgado",     age: 51, job: { biz: "blackline", title: "owner" }, home: "oldrow", money: 5100,
      traits: ["cunning", "patient", "violent"], morality: .2, temper: .5, chattiness: .3,
      goal: "keep the Blackline quiet and the money moving", fear: "Duke's temper drawing heat",
      secret: { type: "crime", text: "is the Red Knives' lieutenant — the Blackline is their counting house" },
      social: "blackline", faction: "gang", lean: "vasquez" },

    // ---- police ----
    { id: "reeves", name: "Ida Reeves",     age: 47, job: { biz: null, title: "police captain" }, home: "meridian", money: 2400,
      traits: ["patient", "cunning", "honest"], morality: .75, temper: .3, chattiness: .3,
      goal: "keep Rusthook from boiling over", fear: "a riot she can't contain",
      secret: null, social: "diner", faction: "police", lean: "vasquez", wage: 30 },
    { id: "sato",   name: "Jun Sato",       age: 30, job: { biz: null, title: "patrol officer" }, home: "dockside", money: 900,
      traits: ["brave", "honest", "reckless"], morality: .9, temper: .5, chattiness: .5,
      goal: "prove there's a leak in the precinct", fear: "being right about it",
      secret: { type: "knowledge", text: "suspects Detective Malley tips off the Red Knives before raids" },
      social: "diner", faction: "police", lean: "okafor", wage: 21 },
    { id: "malley", name: "Cora Malley",    age: 41, job: { biz: null, title: "detective" }, home: "oldrow", money: 3300,
      traits: ["cunning", "greedy"], morality: .25, temper: .4, chattiness: .35,
      goal: "retire before anyone audits her cases", fear: "Internal Affairs",
      secret: { type: "crime", text: "is on the Red Knives payroll — warns them before every raid" },
      social: "blackline", faction: "police", lean: "vasquez", wage: 26 },

    // ---- government / politics ----
    { id: "vasquez", name: "Elena Vasquez", age: 52, job: { biz: null, title: "mayor" }, home: "meridian", money: 6800,
      traits: ["charming", "cunning", "patient"], morality: .45, temper: .3, chattiness: .6,
      goal: "win re-election, whatever Rusthook thinks", fear: "the Meridian donation surfacing",
      secret: { type: "corruption", text: "took a campaign donation from Meridian Development weeks before the plant land was sold to them" },
      social: "club", faction: "government", lean: "vasquez", wage: 40 },
    { id: "hale",   name: "Hale Whitcomb",  age: 45, job: { biz: null, title: "city clerk" }, home: "meridian", money: 1900,
      traits: ["timid", "honest"], morality: .8, temper: .2, chattiness: .4,
      goal: "keep his head down until pension", fear: "the mayor's people",
      secret: { type: "knowledge", text: "filed the land-transfer paperwork: the plant lot went to Meridian Development for a fraction of value" },
      social: "market", faction: "government", lean: "vasquez", wage: 22 },
    { id: "okafor", name: "Ray Okafor",     age: 49, job: { biz: null, title: "union rep / candidate" }, home: "dockside", money: 1500,
      traits: ["brave", "honest", "bitter"], morality: .85, temper: .7, chattiness: .8,
      goal: "beat Vasquez and reopen the plant", fear: "the district giving up",
      secret: null, social: "diner", faction: "workers", lean: "okafor", wage: 15 },

    // ---- Red Knives ----
    { id: "duke",   name: '"Duke" Kessler', age: 36, job: { biz: null, title: "…businessman" }, home: "oldrow", money: 9400,
      traits: ["violent", "cunning", "greedy"], morality: .1, temper: .8, chattiness: .4,
      goal: "own Rusthook's misery — recruit the desperate", fear: "nothing he'd admit to",
      secret: { type: "crime", text: "runs the Red Knives from the Blackline back room" },
      social: "blackline", faction: "gang", lean: "vasquez", wage: 0 },
    { id: "echo",   name: "Echo Ramirez",   age: 23, job: { biz: null, title: "courier" }, home: "dockside", money: 700,
      traits: ["timid", "kind", "reckless"], morality: .55, temper: .3, chattiness: .6,
      goal: "get out of the Knives alive", fear: "Duke finding out she wants out",
      secret: { type: "personal", text: "runs packages for the Red Knives but has been skimming a getaway fund" },
      social: "club", faction: "gang", lean: "undecided", wage: 0 },
    { id: "bram",   name: "Bram Foss",      age: 33, job: { biz: null, title: "doorman (Blackline)" }, home: "oldrow", money: 1200,
      traits: ["violent", "loyal"], morality: .15, temper: .9, chattiness: .2,
      goal: "whatever Duke says", fear: "being useless to Duke",
      secret: { type: "crime", text: "collects the Red Knives' protection money on Fridays" },
      social: "blackline", faction: "gang", lean: "vasquez", wage: 0 },

    // ---- everyone else ----
    { id: "amara",  name: "Amara Osei",     age: 46, job: { biz: "clinic", title: "physician" }, home: "meridian", money: 3100,
      traits: ["kind", "honest", "patient"], morality: .9, temper: .2, chattiness: .4,
      goal: "keep the clinic open for people with nothing", fear: "losing her license",
      secret: { type: "coerced", text: "stitches up Red Knives wounds off the record — Duke made it clear refusal wasn't an option" },
      social: "market", faction: "public", lean: "okafor" },
    { id: "teddy",  name: "Teddy Voss",     age: 68, job: { biz: null, title: "retired dockworker" }, home: "oldrow", money: 800,
      traits: ["patient", "honest", "kind"], morality: .85, temper: .2, chattiness: .9,
      goal: "watch, remember, and be believed", fear: "the district forgetting itself",
      secret: { type: "knowledge", text: "remembers Meridian Development from 1998 — same shell company, same trick, different name" },
      social: "park", faction: "public", lean: "okafor", wage: 8 },
    { id: "june",   name: "June Baker",     age: 19, job: { biz: null, title: "bike courier" }, home: "dockside", money: 300,
      traits: ["reckless", "charming", "kind"], morality: .7, temper: .4, chattiness: .85,
      goal: "save for film school", fear: "ending up like everyone says she will",
      secret: { type: "knowledge", text: "delivered a thick envelope from City Hall to the Blackline the night before the plant closed" },
      social: "park", faction: "public", lean: "undecided", wage: 9 },
  ];

  const HANDLES = {
    tomas: "@reyes_line4", priya: "@priya_builds", dequan: "@holt_heavy", greta: "@qc_greta",
    sam: "@samtorres", ana: "@ana_welds", chuck: "@beaumont_fix", yusuf: "@yusuf_d",
    lena: "@lenaw", marcus: "@vale_auto", rosa: "@kwons_corner", denny: "@denny_k",
    faith: "@rustyanchor", milo: "@milo_livewire", sadie: "@sadie_q", viktor: "@neonpalm",
    nikki: "@nikki_pour", oz: "@blackline_bar", reeves: "@capt_reeves", sato: "@sato_p9",
    malley: "@det_malley", vasquez: "@mayorvasquez", hale: "@hwhitcomb", okafor: "@okafor4rusthook",
    duke: "@dk_ventures", echo: "@echo_rmz", bram: "@bfoss", amara: "@harborclinic",
    teddy: "@old_teddy_v", june: "@junebug_rides",
  };

  NX.DATA = { B, BUSINESSES, RESIDENTS, HANDLES };

  NX.newWorld = function () {
    const seed = (Date.now() % 2147483647) | 0;
    NX.R.seed(seed);

    const buildings = B.map(([id, name, type, gx, gy, gw, gh, color, desc]) =>
      ({ id, name, type, gx, gy, gw, gh, color, desc }));

    const businesses = BUSINESSES.map((b) => ({ ...b, employees: [], revenueToday: 0, badDays: 0, closedDay: null }));

    const residents = RESIDENTS.map((r) => {
      const home = buildings.find((b) => b.id === r.home);
      return {
        ...r,
        alive: true, inJail: 0, missing: false,
        mood: NX.R.int(-5, 25), energy: 100,
        wage: r.wage ?? (r.job.biz ? null : 10), // biz wage resolved below
        employedAt: r.job.biz,
        pos: { x: home.gx + NX.R.val() * home.gw, y: home.gy + NX.R.val() * home.gh },
        at: r.home, target: null,
        relationships: {}, // id -> score -100..100
        playerRel: 0, metPlayer: false,
        memories: [],      // {d, m, text, about, cred, imp}
        beliefs: [],
        arrests: 0, crimesKnown: 0,
      };
    });

    // employment wiring
    for (const r of residents) {
      if (r.job.biz) {
        const biz = businesses.find((b) => b.id === r.job.biz);
        if (biz) { biz.employees.push(r.id); if (r.wage == null) r.wage = biz.wage; }
      }
    }

    // seed relationships: coworkers, same-home neighbors, partners, factions
    const rel = (a, b, v) => {
      const ra = residents.find((x) => x.id === a), rb = residents.find((x) => x.id === b);
      if (ra && rb) { ra.relationships[b] = (ra.relationships[b] || 0) + v; rb.relationships[a] = (rb.relationships[a] || 0) + v; }
    };
    for (const biz of businesses)
      for (let i = 0; i < biz.employees.length; i++)
        for (let j = i + 1; j < biz.employees.length; j++) rel(biz.employees[i], biz.employees[j], NX.R.int(10, 30));
    for (let i = 0; i < residents.length; i++)
      for (let j = i + 1; j < residents.length; j++)
        if (residents[i].home === residents[j].home && NX.R.chance(0.4)) rel(residents[i].id, residents[j].id, NX.R.int(5, 15));
    rel("sam", "lena", 70); rel("rosa", "denny", 60); rel("duke", "oz", 50); rel("duke", "bram", 55);
    rel("oz", "malley", 35); rel("duke", "malley", 30); rel("marcus", "oz", 20); rel("sadie", "duke", 25);
    rel("vasquez", "hale", 25); rel("reeves", "sato", 20); rel("okafor", "dequan", 30); rel("okafor", "yusuf", 30);
    rel("faith", "reeves", 25); rel("teddy", "june", 30); rel("echo", "june", 25); rel("viktor", "nikki", 15);
    rel("viktor", "oz", -25); rel("okafor", "vasquez", -40); rel("sato", "malley", -20); rel("faith", "duke", -35);

    return {
      v: 1, seed, createdAt: Date.now(), savedAt: Date.now(),
      day: 1, minute: 6 * 60, speed: 1,
      player: {
        name: "you", money: 600, home: "dockside",
        pos: { x: 3.5, y: 10.5 }, target: null, at: "dockside",
        rep: { police: 0, gang: 0, business: 0, workers: 0, government: 0, public: 0 },
        knownBy: 0, wanted: 0,
      },
      buildings, businesses, residents,
      economy: {
        taxRate: 0.12, minWage: 12, policeBudget: 5, ubi: false, bizSubsidy: false, surveillance: false,
        treasury: 12000, unemployment: 0, crimeRate: 0, priceIndex: 1.0,
        crimes3d: [0, 0, 0], dailyNote: "",
      },
      election: { day: 7, done: false, winner: null, polls: [] },
      feed: [], eventLog: [], digests: [],
      chat: {},           // residentId -> [{who, text}]
      selected: null,     // selected resident id
      flags: { opening: false, protestFormed: false, truthOut: false, recruitDrive: false },
      counters: { ticks: 0, crimes: 0, arrests: 0, gossipHops: 0 },
    };
  };
})();
