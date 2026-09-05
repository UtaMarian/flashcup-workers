// One-off seed — populates the ChangelogEntry table from the built-in
// version history (RO + EN). Safe to re-run: entries are upserted by version,
// but ONLY when they don't exist yet, so admin edits are never overwritten.
//
// Usage: node scripts/seedChangelog.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// version -> { releaseDate (RO display), translations: { ro, en } }
// Each translation is { title, intro?, items: [{ type, text }] }.
const SEED = [
  {
    version: "2.1.0",
    releaseDate: "31 aug. 2026",
    ro: {
      title: "Meniul de meciuri, reînnoit",
      intro: "Pagina Meciuri are un design nou, în stil fantasy.",
      items: [
        { type: "improved", text: "Trei file simple: Jucate, Deschise și Toate — fără navigare pe etape." },
        { type: "improved", text: "Meciurile sunt grupate pe zile; cele din aceeași zi apar una lângă alta." },
        { type: "new", text: "În capul paginii vezi un preview al meciului următor: embleme, nivelul echipelor, influența și un buton rapid „Adaugă coregrafie”." },
        { type: "improved", text: "Carduri de meci noi: apeși oriunde pe card ca să intri la meci, sau pe o echipă ca să vezi pagina clubului." },
      ],
    },
    en: {
      title: "The matches menu, refreshed",
      intro: "The Matches page has a new, fantasy-style design.",
      items: [
        { type: "improved", text: "Three simple tabs: Played, Open and All — no more matchday browsing." },
        { type: "improved", text: "Fixtures are grouped by day; matches on the same day sit side by side." },
        { type: "new", text: "A next-match preview at the top: crests, squad levels, influence and a quick “Add choreography” button." },
        { type: "improved", text: "New match cards: tap anywhere on the card to open the match, or a team to open its club page." },
      ],
    },
  },
  {
    version: "2.0.0",
    releaseDate: "31 aug. 2026",
    ro: {
      title: "Am devenit Flash Cup",
      intro: "Aplicația se numește acum Flash Cup, iar în culise am reconstruit tot ce ține de cont și securitate.",
      items: [
        { type: "new", text: "Te înregistrezi și te autentifici cu contul de Google sau de Facebook, dintr-un singur clic." },
        { type: "new", text: "Conturile cu email și parolă își confirmă adresa cu un cod primit pe email înainte de a intra în joc." },
        { type: "new", text: "Ți-ai uitat parola? O resetezi singur, cu un cod trimis pe email." },
        { type: "improved", text: "Am mutat jocul pe o bază de date mai rapidă și mai fiabilă — se încarcă mai bine și apar mai puține erori." },
        { type: "improved", text: "Numele și emblema aplicației au fost înnoite peste tot (Flash League a devenit Flash Cup)." },
      ],
    },
    en: {
      title: "We're now Flash Cup",
      intro: "The app is now called Flash Cup, and behind the scenes we rebuilt everything around accounts and security.",
      items: [
        { type: "new", text: "Sign up and log in with your Google or Facebook account in one click." },
        { type: "new", text: "Email + password accounts confirm their address with an emailed code before entering the game." },
        { type: "new", text: "Forgot your password? Reset it yourself with a code sent to your email." },
        { type: "improved", text: "We moved the game to a faster, more reliable database — better loading and fewer errors." },
        { type: "improved", text: "The app name and logo were refreshed everywhere (Flash League became Flash Cup)." },
      ],
    },
  },
  {
    version: "1.3.0",
    releaseDate: "30 aug. 2026",
    ro: {
      title: "Cont, limbă și transparență",
      items: [
        { type: "new", text: "Poți alege limba aplicației din meniul contului — 9 limbi disponibile." },
        { type: "new", text: "Pagină de Contact: trimiți direct echipei o întrebare, o eroare sau o sugestie." },
        { type: "new", text: "Pagini de Confidențialitate și Termeni, plus acest Jurnal de actualizări." },
        { type: "improved", text: "Meniu de cont nou, cu acces rapid la profil și la deconectare." },
        { type: "improved", text: "Bara de sus reorganizată — resursele grupate într-un singur loc, cu energia lângă ele." },
      ],
    },
    en: {
      title: "Account, language and transparency",
      items: [
        { type: "new", text: "You can pick the app language from the account menu — 9 languages available." },
        { type: "new", text: "Contact page: send the team a question, a bug report or a suggestion directly." },
        { type: "new", text: "Privacy and Terms pages, plus this Update log." },
        { type: "improved", text: "New account menu with quick access to your profile and log out." },
        { type: "improved", text: "Reorganised top bar — resources grouped in one place, with energy next to them." },
      ],
    },
  },
  {
    version: "1.2.0",
    releaseDate: "30 aug. 2026",
    ro: {
      title: "Față nouă",
      items: [
        { type: "improved", text: "Poziția jucătorului apare peste tot cu culori (portar, fundaș, mijlocaș, atacant)." },
        { type: "improved", text: "Banii, tokenii și nivelul au iconițe noi, la fel în toată aplicația." },
        { type: "new", text: "La Competiții vezi forma echipei (ultimele 5 meciuri) și un clasament mai clar." },
        { type: "improved", text: "Lista lotului e sortată: primul 11 întâi, apoi rezervele după nivel." },
        { type: "improved", text: "Notificările de evenimente și cardul „Meciuri viitoare” au un design nou." },
      ],
    },
    en: {
      title: "A fresh look",
      items: [
        { type: "improved", text: "Player position is shown everywhere in colour (goalkeeper, defender, midfielder, forward)." },
        { type: "improved", text: "Cash, tokens and level have new icons, consistent across the whole app." },
        { type: "new", text: "Competitions now show club form (last 5 matches) and a clearer standings table." },
        { type: "improved", text: "The squad list is sorted: starting XI first, then the bench by level." },
        { type: "improved", text: "Event notifications and the “Upcoming matches” card have a new design." },
      ],
    },
  },
  {
    version: "1.1.0",
    releaseDate: "30 aug. 2026",
    ro: {
      title: "Evenimente",
      items: [
        { type: "new", text: "Evenimente pe timp limitat pornite de administrator: XP dublu la antrenament, recompense duble la meci, super-pariu, roata norocului, regenerare rapidă de energie și altele." },
        { type: "new", text: "Fiecare eveniment are propriul afiș și duce direct la pagina potrivită." },
        { type: "new", text: "La Competiții, meciurile sunt grupate pe etape, pentru fiecare ligă." },
        { type: "improved", text: "Linkuri către pagina echipei și a meciului din toată aplicația." },
      ],
    },
    en: {
      title: "Events",
      items: [
        { type: "new", text: "Time-limited events started by an admin: double training XP, double match rewards, super-bet, prize wheel, fast energy regen and more." },
        { type: "new", text: "Every event has its own cover and links straight to the right page." },
        { type: "new", text: "In Competitions, matches are grouped by matchday, for each league." },
        { type: "improved", text: "Links to the club page and the match page throughout the app." },
      ],
    },
  },
  {
    version: "1.0.2",
    releaseDate: "29 aug. 2026",
    ro: { title: "Telefon și tabletă", items: [{ type: "improved", text: "Aplicația arată și funcționează mult mai bine pe ecrane mici." }] },
    en: { title: "Phone and tablet", items: [{ type: "improved", text: "The app looks and works much better on small screens." }] },
  },
  {
    version: "1.0.1",
    releaseDate: "29 aug. 2026",
    ro: { title: "Logo nou", items: [{ type: "improved", text: "Logo-ul aplicației a fost înnoit." }] },
    en: { title: "New logo", items: [{ type: "improved", text: "The app logo was refreshed." }] },
  },
  {
    version: "1.0.0",
    releaseDate: "29 aug. 2026",
    ro: {
      title: "Lansarea Flash Cup",
      intro: "Prima versiune publică. Flash Cup este un joc în care îți creezi un fotbalist, îl antrenezi și joci alături de o echipă condusă de un manager. Iată ce poți face:",
      items: [
        { type: "new", text: "Îți faci un cont și alegi poziția și naționalitatea fotbalistului tău." },
        { type: "new", text: "Te antrenezi ca să crești viteza, tehnica, pasa, fizicul, apărarea și atacul — antrenamentul consumă energie, care se reface în timp." },
        { type: "new", text: "Te alături unei echipe sau, ca manager, îți construiești lotul, alegi primul 11 și tactica." },
        { type: "new", text: "Joci meciuri de ligă și de cupă, cu simulare minut cu minut, și urci în clasament." },
        { type: "new", text: "Câștigi experiență, niveluri, bani și tokeni; primești un bonus zilnic." },
        { type: "new", text: "Faci coregrafii ale galeriei pentru influență în meci." },
        { type: "new", text: "Pariezi pe rezultatele meciurilor la secțiunea Predicții." },
        { type: "new", text: "Transferuri: managerii fac oferte, jucătorii pot fi liberi de contract sau listați." },
        { type: "new", text: "Aduni trofee și distincții (inclusiv titlul de MVP) pe profilul public." },
        { type: "new", text: "Urmărești recordurile, istoricul sezoanelor și clasamentele all-time." },
      ],
    },
    en: {
      title: "Flash Cup launch",
      intro: "The first public version. Flash Cup is a game where you create a footballer, train them and play alongside a team run by a manager. Here is what you can do:",
      items: [
        { type: "new", text: "Create an account and choose your footballer's position and nationality." },
        { type: "new", text: "Train to raise speed, technique, passing, physical, defending and attacking — training costs energy, which refills over time." },
        { type: "new", text: "Join a team or, as a manager, build the squad, pick the starting XI and the tactics." },
        { type: "new", text: "Play league and cup matches with minute-by-minute simulation and climb the table." },
        { type: "new", text: "Earn experience, levels, cash and tokens; collect a daily bonus." },
        { type: "new", text: "Create crowd choreographies for match influence." },
        { type: "new", text: "Bet on match results in the Predictions section." },
        { type: "new", text: "Transfers: managers make offers, players can be free agents or listed." },
        { type: "new", text: "Collect trophies and distinctions (including the MVP title) on your public profile." },
        { type: "new", text: "Follow records, season history and all-time leaderboards." },
      ],
    },
  },
];

async function main() {
  let created = 0;
  let skipped = 0;
  for (let i = 0; i < SEED.length; i++) {
    const s = SEED[i];
    const existing = await prisma.changelogEntry.findUnique({ where: { version: s.version } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.changelogEntry.create({
      data: {
        version: s.version,
        releaseDate: s.releaseDate,
        published: true,
        sortKey: SEED.length - i, // newest (index 0) gets the highest key
        translations: JSON.stringify({ ro: s.ro, en: s.en }),
      },
    });
    created++;
  }
  console.log(`[seed:changelog] created ${created}, skipped ${skipped} (already present).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
