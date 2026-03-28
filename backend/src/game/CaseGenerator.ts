import { CaseDetails } from '../types';

const CASE_POOL: CaseDetails[] = [
  {
    defendant: 'Gerald "The Goose" McHonkington',
    crime: 'Grand Theft Birdseed from the Municipal Park Reserve',
    evidence: ['A beak-shaped crowbar', 'Feathers found at the scene', 'A signed confession written in honking notation'],
  },
  {
    defendant: 'Professor Bartholomew Crumpet III',
    crime: 'Illegally operating a time machine without a license',
    evidence: ['A suspiciously ticking briefcase', 'A newspaper from 2087', 'A parking ticket from Ancient Rome'],
  },
  {
    defendant: 'Señorita Margarita Pizzazz',
    crime: 'Smuggling unlicensed dance moves across state lines',
    evidence: ['A suitcase full of choreography notes', 'Surveillance footage of suspicious moonwalking', 'Witness testimony from a traumatized DJ'],
  },
  {
    defendant: 'Captain Reginald Socksworth',
    crime: 'Operating a pirate ship in a public swimming pool',
    evidence: ['A miniature Jolly Roger flag', 'Pool floaties converted into cannons', 'A treasure map drawn on a swim noodle'],
  },
  {
    defendant: 'Dr. Waffles McFluffington',
    crime: 'Performing unlicensed brain surgery on a teddy bear',
    evidence: ['A teddy bear with a suspicious zipper', 'Cotton ball forensic evidence', 'A diploma from "Stuffed Animal Medical School"'],
  },
  {
    defendant: 'The Honorable Cheese Wheel Johnson',
    crime: 'Impersonating a wheel of aged Gouda at a cheese festival',
    evidence: ['A yellow body suit with suspicious holes', 'A fake cheese certification', 'Witness reports of "human-like blinking"'],
  },
  {
    defendant: 'Madame Sparkletoots the Magnificent',
    crime: 'Running an underground glitter trafficking ring',
    evidence: ['47 pounds of unregistered craft glitter', 'A coded message written in sequins', 'Glitter residue on every surface within 3 miles'],
  },
  {
    defendant: 'Broseph "Bro" Broheimer',
    crime: 'Excessive high-fiving in a no-high-five zone',
    evidence: ['Red handprint marks on 23 victims', 'Security footage of an unbroken 4-hour high-five streak', 'A hand-shaped dent in a stop sign'],
  },
  {
    defendant: 'Countess Penelope von Noodlesworth',
    crime: 'Replacing the town\'s water supply with chicken broth',
    evidence: ['Suspiciously savory tap water samples', 'An industrial broth funnel', 'A manifesto titled "The Broth Supremacy"'],
  },
  {
    defendant: 'Detective Mittens Whiskerface',
    crime: 'Framing an innocent goldfish for bank robbery',
    evidence: ['A tiny ski mask found in a fishbowl', 'Forged paw-print evidence', 'A catnip-funded offshore account'],
  },
  {
    defendant: 'Sir Reginald Von Floppington',
    crime: 'Launching a rogue satellite made entirely of toast',
    evidence: ['Breadcrumbs in low-Earth orbit', 'A butter-stained launch manifest', 'NASA complaints about "breakfast interference"'],
  },
  {
    defendant: 'Grandma "Speed Demon" Ethel',
    crime: 'Drag racing mobility scooters in a hospital corridor',
    evidence: ['Tire marks on the ICU floor', 'A NOS canister attached to a scooter basket', 'A checkered flag made from hospital gowns'],
  },
  {
    defendant: 'The Mysterious Figure Known Only As "Kevin"',
    crime: 'Stealing the concept of Tuesdays',
    evidence: ['Calendars worldwide now skip from Monday to Wednesday', 'A vault containing 52 stolen Tuesdays', 'A ransom note demanding "better weekend placement"'],
  },
  {
    defendant: 'Baron Reginald Fluffernutter',
    crime: 'Tax evasion through an elaborate system of sock puppets',
    evidence: ['327 sock puppets each with their own Social Security number', 'Tiny briefcases containing miniature tax returns', 'A puppet-sized offshore bank in the Cayman Islands'],
  },
  {
    defendant: 'DJ Thundersocks',
    crime: 'Noise pollution from playing the world\'s loudest kazoo at 3 AM',
    evidence: ['A weaponized kazoo registered as a class-3 instrument', 'Seismograph readings from the kazoo solo', 'Noise complaints from residents 4 towns over'],
  },
  {
    defendant: 'Professor Linguini Fettuccine',
    crime: 'Teaching spaghetti to become sentient',
    evidence: ['A bowl of pasta that passed the Turing test', 'Lab notes titled "Project Al Dente"', 'A spaghetti strand that filed for workers\' compensation'],
  },
  {
    defendant: 'Lord Reginald Bumblesworth',
    crime: 'Training an army of bees to deliver strongly-worded letters',
    evidence: ['Bee-sting sealed envelopes', 'A beehive converted into a mail sorting facility', 'Multiple victims with "buzz off" stung into their arms'],
  },
  {
    defendant: 'Mx. Pudding Pop Deluxe',
    crime: 'Operating a black-market rainbow factory without EPA approval',
    evidence: ['Unauthorized rainbows appearing over the defendant\'s property', 'Barrels of concentrated ROYGBIV', 'A Leprechaun union grievance filing'],
  },
  {
    defendant: 'General Tater Tot McSprout',
    crime: 'Attempting to overthrow the government with a potato-based militia',
    evidence: ['A manifesto titled "The Tuber Revolution"', 'Potato guns modified for combat use', 'A war room map where every country is renamed after a potato dish'],
  },
  {
    defendant: 'Ambassador Quacksworth of the Pond Republic',
    crime: 'Diplomatic fraud — claiming to represent a nation of ducks',
    evidence: ['A forged treaty signed with a webbed footprint', 'A "passport" laminated in bread crumbs', 'United Nations complaints about "persistent quacking during sessions"'],
  },
];

let lastCaseIndex = -1;

export function generateCase(): CaseDetails {
  let index: number;
  do {
    index = Math.floor(Math.random() * CASE_POOL.length);
  } while (index === lastCaseIndex && CASE_POOL.length > 1);

  lastCaseIndex = index;
  return { ...CASE_POOL[index] };
}
