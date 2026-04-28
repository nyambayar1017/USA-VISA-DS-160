// USM-only enhancement: replace the free-text Nationality input with a
// searchable dropdown of nationalities. DTX serves Mongolian tourists and
// keeps the simple input. The MRZ auto-fill writes alpha-3 codes ("MNG",
// "USA"), which match these option values directly so passport scanning
// keeps working.
(function () {
  if (window.NationalitySelect) return;

  const COUNTRIES = [
    ["AFG", "Afghan"], ["ALB", "Albanian"], ["DZA", "Algerian"], ["AND", "Andorran"],
    ["AGO", "Angolan"], ["ARG", "Argentine"], ["ARM", "Armenian"], ["AUS", "Australian"],
    ["AUT", "Austrian"], ["AZE", "Azerbaijani"], ["BHS", "Bahamian"], ["BHR", "Bahraini"],
    ["BGD", "Bangladeshi"], ["BRB", "Barbadian"], ["BLR", "Belarusian"], ["BEL", "Belgian"],
    ["BLZ", "Belizean"], ["BEN", "Beninese"], ["BTN", "Bhutanese"], ["BOL", "Bolivian"],
    ["BIH", "Bosnian"], ["BWA", "Botswanan"], ["BRA", "Brazilian"], ["BRN", "Bruneian"],
    ["BGR", "Bulgarian"], ["BFA", "Burkinabé"], ["BDI", "Burundian"], ["KHM", "Cambodian"],
    ["CMR", "Cameroonian"], ["CAN", "Canadian"], ["CPV", "Cape Verdean"], ["CAF", "Central African"],
    ["TCD", "Chadian"], ["CHL", "Chilean"], ["CHN", "Chinese"], ["COL", "Colombian"],
    ["COM", "Comoran"], ["COG", "Congolese"], ["COD", "Congolese (DRC)"], ["CRI", "Costa Rican"],
    ["CIV", "Ivorian"], ["HRV", "Croatian"], ["CUB", "Cuban"], ["CYP", "Cypriot"],
    ["CZE", "Czech"], ["DNK", "Danish"], ["DJI", "Djiboutian"], ["DMA", "Dominican"],
    ["DOM", "Dominican (Republic)"], ["ECU", "Ecuadorian"], ["EGY", "Egyptian"], ["SLV", "Salvadoran"],
    ["GNQ", "Equatorial Guinean"], ["ERI", "Eritrean"], ["EST", "Estonian"], ["SWZ", "Eswatini"],
    ["ETH", "Ethiopian"], ["FJI", "Fijian"], ["FIN", "Finnish"], ["FRA", "French"],
    ["GAB", "Gabonese"], ["GMB", "Gambian"], ["GEO", "Georgian"], ["DEU", "German"],
    ["GHA", "Ghanaian"], ["GRC", "Greek"], ["GRD", "Grenadian"], ["GTM", "Guatemalan"],
    ["GIN", "Guinean"], ["GNB", "Bissau-Guinean"], ["GUY", "Guyanese"], ["HTI", "Haitian"],
    ["HND", "Honduran"], ["HKG", "Hong Konger"], ["HUN", "Hungarian"], ["ISL", "Icelandic"],
    ["IND", "Indian"], ["IDN", "Indonesian"], ["IRN", "Iranian"], ["IRQ", "Iraqi"],
    ["IRL", "Irish"], ["ISR", "Israeli"], ["ITA", "Italian"], ["JAM", "Jamaican"],
    ["JPN", "Japanese"], ["JOR", "Jordanian"], ["KAZ", "Kazakhstani"], ["KEN", "Kenyan"],
    ["KIR", "I-Kiribati"], ["PRK", "North Korean"], ["KOR", "South Korean"], ["KWT", "Kuwaiti"],
    ["KGZ", "Kyrgyzstani"], ["LAO", "Lao"], ["LVA", "Latvian"], ["LBN", "Lebanese"],
    ["LSO", "Basotho"], ["LBR", "Liberian"], ["LBY", "Libyan"], ["LIE", "Liechtensteiner"],
    ["LTU", "Lithuanian"], ["LUX", "Luxembourger"], ["MAC", "Macanese"], ["MDG", "Malagasy"],
    ["MWI", "Malawian"], ["MYS", "Malaysian"], ["MDV", "Maldivian"], ["MLI", "Malian"],
    ["MLT", "Maltese"], ["MHL", "Marshallese"], ["MRT", "Mauritanian"], ["MUS", "Mauritian"],
    ["MEX", "Mexican"], ["FSM", "Micronesian"], ["MDA", "Moldovan"], ["MCO", "Monégasque"],
    ["MNG", "Mongolian"], ["MNE", "Montenegrin"], ["MAR", "Moroccan"], ["MOZ", "Mozambican"],
    ["MMR", "Burmese"], ["NAM", "Namibian"], ["NRU", "Nauruan"], ["NPL", "Nepali"],
    ["NLD", "Dutch"], ["NZL", "New Zealander"], ["NIC", "Nicaraguan"], ["NER", "Nigerien"],
    ["NGA", "Nigerian"], ["MKD", "Macedonian"], ["NOR", "Norwegian"], ["OMN", "Omani"],
    ["PAK", "Pakistani"], ["PLW", "Palauan"], ["PSE", "Palestinian"], ["PAN", "Panamanian"],
    ["PNG", "Papua New Guinean"], ["PRY", "Paraguayan"], ["PER", "Peruvian"], ["PHL", "Filipino"],
    ["POL", "Polish"], ["PRT", "Portuguese"], ["QAT", "Qatari"], ["ROU", "Romanian"],
    ["RUS", "Russian"], ["RWA", "Rwandan"], ["KNA", "Kittitian"], ["LCA", "Saint Lucian"],
    ["VCT", "Saint Vincentian"], ["WSM", "Samoan"], ["SMR", "Sammarinese"], ["STP", "Santomean"],
    ["SAU", "Saudi"], ["SEN", "Senegalese"], ["SRB", "Serbian"], ["SYC", "Seychellois"],
    ["SLE", "Sierra Leonean"], ["SGP", "Singaporean"], ["SVK", "Slovak"], ["SVN", "Slovenian"],
    ["SLB", "Solomon Islander"], ["SOM", "Somali"], ["ZAF", "South African"], ["SSD", "South Sudanese"],
    ["ESP", "Spanish"], ["LKA", "Sri Lankan"], ["SDN", "Sudanese"], ["SUR", "Surinamese"],
    ["SWE", "Swedish"], ["CHE", "Swiss"], ["SYR", "Syrian"], ["TWN", "Taiwanese"],
    ["TJK", "Tajikistani"], ["TZA", "Tanzanian"], ["THA", "Thai"], ["TLS", "Timorese"],
    ["TGO", "Togolese"], ["TON", "Tongan"], ["TTO", "Trinidadian"], ["TUN", "Tunisian"],
    ["TUR", "Turkish"], ["TKM", "Turkmen"], ["TUV", "Tuvaluan"], ["UGA", "Ugandan"],
    ["UKR", "Ukrainian"], ["ARE", "Emirati"], ["GBR", "British"], ["USA", "American"],
    ["URY", "Uruguayan"], ["UZB", "Uzbekistani"], ["VUT", "Ni-Vanuatu"], ["VAT", "Vatican"],
    ["VEN", "Venezuelan"], ["VNM", "Vietnamese"], ["YEM", "Yemeni"], ["ZMB", "Zambian"],
    ["ZWE", "Zimbabwean"],
  ];

  function readWorkspace() {
    try {
      return localStorage.getItem("activeWorkspace") || "";
    } catch { return ""; }
  }

  function buildSelect(input) {
    const sel = document.createElement("select");
    for (const attr of input.attributes) {
      // Carry over name, required, etc — but skip type, placeholder, etc that
      // don't apply to a <select>.
      if (["type", "placeholder", "data-uppercase"].includes(attr.name)) continue;
      sel.setAttribute(attr.name, attr.value);
    }
    sel.classList.add("nationality-select");
    sel.innerHTML = '<option value="">— Pick nationality —</option>' +
      COUNTRIES.map(([code, name]) => `<option value="${code}">${name} (${code})</option>`).join("");
    if (input.value) {
      const v = String(input.value).trim().toUpperCase();
      // Try direct code match first, then nationality-name match.
      const byCode = COUNTRIES.find(([c]) => c === v);
      const byName = COUNTRIES.find(([, n]) => n.toUpperCase() === v);
      const matched = byCode || byName;
      if (matched) sel.value = matched[0];
    }
    return sel;
  }

  function applyTo(form) {
    if (!form) return;
    if (readWorkspace() !== "USM") return;
    const input = form.querySelector('input[name="nationality"]');
    if (!input || input.dataset.nationalityUpgraded) return;
    const sel = buildSelect(input);
    sel.dataset.nationalityUpgraded = "1";
    input.replaceWith(sel);
  }

  window.NationalitySelect = { applyTo, COUNTRIES };
})();
