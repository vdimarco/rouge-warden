// First Breath: the source allow-list (design.md 15.1, 15.3). A fact's `src` keys must be keys of SOURCES; each entry
// is { name, url } for the Sources screen and "What was real". Built from openspec/changes/add-first-breath/research/
// research-biology.md section 12 and the URLs written inline beside its facts, plus the sources named in design.md
// 15.3. Pure data.
//
// Keys are the short names of design.md 15.3 ("NHS week 15", "CC 23439", "PMID 16272225", "TTUHSC"). The longer
// spellings used in the 15.2 fact table ("CC 23439 ovulation", "UNSW Carnegie table", "RCOG breech", ...) are keys
// too, for the same entry, so a stage can copy either.
//
// Left out on purpose (contract choices): sources the research sheet saw only as search text (S): StatPearls
// NBK542186, NICE QS105 and the old NHS 13-to-27 page; the retracted 2020 sperm-tail paper (PMID 32789171) and its
// notice (PMID 34019482); and the hazard pages (CDC FASD, CDC CMV, NHS smoking), since the game names no hazards
// tied to the mother (section 2).

const NHS = "https://www.nhs.uk/best-start-in-life/pregnancy/week-by-week-guide-to-pregnancy/";
const trimester = (n) => (n <= 12 ? "1st" : n <= 27 ? "2nd" : "3rd");
const CC = "https://my.clevelandclinic.org/health/";
const UNSW = "https://embryology.med.unsw.edu.au/embryology/index.php/";
const pubmed = (id) => `https://pubmed.ncbi.nlm.nih.gov/${id}/`;

// PubMed ids from section 12, with the names it gives them, as written there.
const PAPERS = {
  16272225: "Suarez & Pacey 2006", 26183721: "Suarez 2016", 16607290: "Eisenbach & Giojalas 2006", 8671281: "Kunz 1996",
  8150897: "Williams 1993", 7479932: "Cohen-Dayag 1995", 23453951: "Miki & Clapham 2013",
  22848657: "thermotaxis, PLoS One 2012", 25609239: "thermotaxis, Hum Reprod 2015", 21412339: "Lishko 2011",
  32517615: "Fitzpatrick 2020", 26386468: "Sakkas 2015", 3979580: "Pandya & Cohen 1985", 7477165: "Wilcox 1995",
  10362823: "Wilcox 1999", 21383182: "Jin 2011", 24739963: "Bianchi 2014", 33964210: "Cavazza 2021",
  11106583: "Jauniaux 2000", 12050279: "Burton 2002", 22235228: "Palmeira 2012", 7979483: "Hepper 1994",
  12741744: "Kisilevsky 2003", 7094856: "Nijhuis 1982", 7375928: "DeCasper & Fifer 1980", 23164177: "Hillman 2012",
  34214716: "Iversen 2021", 22068695: "Baerwald 2012",
};

const list = {};
const add = (key, name, url, ...aliases) => {
  const entry = Object.freeze({ name, url });
  for (const k of [key, ...aliases]) list[k] = entry;
};

// NHS week by week, weeks 4 to 40 (each page sits under its trimester).
for (let n = 4; n <= 40; n++) add(`NHS week ${n}`, `NHS: week ${n}`, `${NHS}${trimester(n)}-trimester/week-${n}/`);
add("NHS week by week", "NHS: your pregnancy week by week", NHS);
add("NHS skin-to-skin", "NHS: skin-to-skin contact with your newborn",
  "https://www.nhs.uk/best-start-in-life/baby/baby-basics/caring-for-your-baby/skin-to-skin-contact-with-your-newborn/");
add("NHS breech", "NHS: if your baby is breech", "https://www.nhs.uk/pregnancy/labour-and-birth/what-happens/if-your-baby-is-breech/");
add("NHS 5 weeks (old page)", "NHS: 5 weeks pregnant", "https://www.nhs.uk/pregnancy/week-by-week/1-to-12/5-weeks/");

// Cleveland Clinic
add("CC sperm", "Cleveland Clinic: sperm", `${CC}body/sperm`);
add("CC 23439", "Cleveland Clinic: ovulation", `${CC}body/23439-ovulation`, "CC 23439 ovulation");
add("CC 24346", "Cleveland Clinic: fimbriae", `${CC}body/24346-fimbriae`, "CC 24346 fimbriae");
add("CC 11585", "Cleveland Clinic: conception", `${CC}articles/11585-conception`, "CC 11585 conception");
add("CC 22889", "Cleveland Clinic: blastocyst", `${CC}body/22889-blastocyst`, "CC 22889 blastocyst");
add("CC 22489", "Cleveland Clinic: hCG", `${CC}articles/22489-human-chorionic-gonadotropin`, "CC 22489 hCG");
add("CC 22337", "Cleveland Clinic: placenta", `${CC}body/22337-placenta`, "CC 22337 placenta");
add("CC umbilical cord", "Cleveland Clinic: umbilical cord", `${CC}body/umbilical-cord`);
add("CC 7247", "Cleveland Clinic: fetal development", `${CC}articles/7247-fetal-development-stages-of-growth`,
  "CC 7247 fetal development");
add("CC 9699", "Cleveland Clinic: first trimester", `${CC}articles/9699-first-trimester`, "CC 9699 first trimester");
add("CC 22829", "Cleveland Clinic: quickening", `${CC}body/22829-quickening-in-pregnancy`, "CC 22829 quickening");
add("CC 22640", "Cleveland Clinic: stages of labor", `${CC}body/22640-stages-of-labor`, "CC 22640 stages of labor");
add("CC 23094", "Cleveland Clinic: Apgar score", `${CC}diagnostics/23094-apgar-score`, "CC 23094 Apgar");
add("CC 21957", "Cleveland Clinic: cervical mucus", `${CC}body/21957-cervical-mucus`, "CC 21957 cervical mucus");

// MedlinePlus
add("MedlinePlus 002398", "MedlinePlus: fetal development", "https://medlineplus.gov/ency/article/002398.htm");
add("MedlinePlus 002395", "MedlinePlus: changes in the newborn at birth", "https://medlineplus.gov/ency/article/002395.htm");
add("MedlinePlus 003402", "MedlinePlus: Apgar score", "https://medlineplus.gov/ency/article/003402.htm");

// Other patient-health pages
add("Stanford fetal circulation", "Stanford Medicine Children's Health: fetal circulation",
  "https://www.stanfordchildrens.org/en/topic/default?id=fetal-circulation-90-P01790");
add("MSD perinatal physiology", "MSD Manual Professional: perinatal physiology",
  "https://www.msdmanuals.com/professional/pediatrics/perinatal-physiology/perinatal-physiology");
add("RCOG", "RCOG: a breech baby at the end of pregnancy",
  "https://www.rcog.org.uk/for-the-public/browse-our-patient-information/breech-baby-at-the-end-of-pregnancy/", "RCOG breech");

// Embryology references
add("UNSW Carnegie", "UNSW Embryology: Carnegie stage table", `${UNSW}Carnegie_stage_table`, "UNSW Carnegie table");
add("UNSW Week 1", "UNSW Embryology: week 1", `${UNSW}Week_1`);
add("UNSW Week 2", "UNSW Embryology: week 2", `${UNSW}Week_2`);
add("UNSW heart", "UNSW Embryology: heart development", `${UNSW}Cardiovascular_System_-_Heart_Development`);
add("UNSW neural tube", "UNSW Embryology: the neural tube", `${UNSW}Abnormal_Development_-_Folic_Acid_and_Neural_Tube_Defects`);
add("UNSW placenta", "UNSW Embryology: placenta development", `${UNSW}Placenta_Development`);
add("ASU Carnegie", "Embryo Project Encyclopedia: Carnegie stages", "https://embryo.asu.edu/pages/carnegie-stages");
add("embryology.ch migration", "embryology.ch: the embryo's trip down the tube",
  "https://embryology.ch/en/embryogenese/preimplantation/segmentation-migration/migration-embryon.html");
add("embryology.ch villi", "embryology.ch: the three villus types",
  "https://embryology.ch/en/embryogenese/fetal-membranes-and-placenta/development-of-the-placental-villi/the-three-villus-types/");
add("SIU placenta", "SIU histology: placenta", "https://histology.siu.edu/erg/placenta.htm");
add("TTUHSC", "TTUHSC El Paso: the first week", "https://anatomy.ttuhscep.edu/embryo/03firstweek.htm", "TTUHSC first week");
add("ESHRE atlas", "ESHRE Atlas of human embryology", "https://atlas.eshre.eu/es/14550068476800020");
add("GLOWM", "GLOWM: presentation and mechanism of labor",
  "https://www.glowm.com/article/heading/vol-11--labor-and-delivery--presentation-and-mechanism-of-labor/id/414323");
add("OB-GYN 101", "OB-GYN 101: the mechanism of normal labor",
  "https://oacapps.med.jhmi.edu/OBGYN-101/Text/Labor%20and%20Delivery/mechanism_of_normal_labor.htm", "OB-GYN 101 mechanism");
add("OpenStax 15.2", "OpenStax Maternal-Newborn Nursing 15.2: stages of labor",
  "https://openstax.org/books/maternal-newborn-nursing/pages/15-2-stages-of-labor");
add("Teach Me Physiology labour", "TeachMePhysiology: labour", "https://teachmephysiology.com/reproductive-system/pregnancy/labour/");
add("WHO", "WHO fetal growth charts (Kiserud et al. 2017)",
  "https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.1002220", "WHO fetal growth charts");
add("BioNumbers 111184", "BioNumbers 111184: the human egg", "https://bionumbers.hms.harvard.edu/bionumber.aspx?id=111184");
add("BioNumbers 114281", "BioNumbers 114281: sperm speed", "https://bionumbers.hms.harvard.edu/bionumber.aspx?id=114281");

// Papers
for (const [id, name] of Object.entries(PAPERS)) add(`PMID ${id}`, `${name} (PubMed ${id})`, pubmed(id));
add("DOI 10.1098/rspb.2020.0805", "Fitzpatrick et al. 2020, Proc. R. Soc. B", "https://doi.org/10.1098/rspb.2020.0805");
add("DOI 10.1086/494680", "Martin 1991, Signs 16(3)", "https://doi.org/10.1086/494680");

export const SOURCES = Object.freeze(list);
