import type { QuizDataset } from '../types';
import { UkMap } from '../maps';

function a(id: string, label: string, x: number, y: number, ...aliases: string[]) {
  return { id, label, aliases, x, y };
}

export const ukDataset: QuizDataset = {
  id: 'uk',
  title: 'UK Cities and Towns',
  emoji: '🇬🇧',
  description: 'Can you name these 64 major UK cities and towns?',
  mapComponent: UkMap,
  timeLimit: 10 * 60,
  answers: [
    // England
    a('london', 'London', 46, 38),
    a('birmingham', 'Birmingham', 40, 30),
    a('manchester', 'Manchester', 38, 24),
    a('leeds', 'Leeds', 40, 22),
    a('liverpool', 'Liverpool', 36, 26),
    a('newcastle', 'Newcastle upon Tyne', 40, 16, 'newcastle'),
    a('sheffield', 'Sheffield', 40, 28),
    a('bristol', 'Bristol', 38, 36),
    a('leicester', 'Leicester', 42, 30),
    a('coventry', 'Coventry', 42, 32),
    a('nottingham', 'Nottingham', 42, 28),
    a('plymouth', 'Plymouth', 34, 42),
    a('exeter', 'Exeter', 36, 40),
    a('southampton', 'Southampton', 42, 40),
    a('portsmouth', 'Portsmouth', 44, 40),
    a('brighton', 'Brighton', 46, 40),
    a('oxford', 'Oxford', 42, 36),
    a('cambridge', 'Cambridge', 46, 34),
    a('norwich', 'Norwich', 48, 30),
    a('ipswich', 'Ipswich', 48, 32),
    a('york', 'York', 40, 20),
    a('hull', 'Kingston upon Hull', 44, 20, 'hull'),
    a('sunderland', 'Sunderland', 40, 14),
    a('durham', 'Durham', 40, 16),
    a('carlisle', 'Carlisle', 36, 16),
    a('blackpool', 'Blackpool', 36, 24),
    a('preston', 'Preston', 37, 24),
    a('bolton', 'Bolton', 38, 24),
    a('rotherham', 'Rotherham', 40, 26),
    a('doncaster', 'Doncaster', 42, 26),
    a('lincoln', 'Lincoln', 44, 26),
    a('derby', 'Derby', 42, 30),
    a('wolverhampton', 'Wolverhampton', 40, 32),
    a('worcester', 'Worcester', 40, 34),
    a('gloucester', 'Gloucester', 40, 36),
    a('swindon', 'Swindon', 40, 36),
    a('reading', 'Reading', 44, 38),
    a('luton', 'Luton', 44, 36),
    a('northampton', 'Northampton', 44, 34),
    a('peterborough', 'Peterborough', 46, 32),
    a('chelmsford', 'Chelmsford', 48, 36),
    a('southend', 'Southend-on-Sea', 48, 38, 'southend'),
    a('canterbury', 'Canterbury', 46, 40),
    a('dover', 'Dover', 48, 40),
    a('portsmouth2', 'Portsmouth', 44, 40), // deduped below

    // Scotland
    a('edinburgh', 'Edinburgh', 34, 14),
    a('glasgow', 'Glasgow', 32, 16),
    a('aberdeen', 'Aberdeen', 36, 10),
    a('dundee', 'Dundee', 34, 12),
    a('inverness', 'Inverness', 32, 8),
    a('stirling', 'Stirling', 32, 14),
    a('perth', 'Perth', 34, 12),
    a('dumfries', 'Dumfries', 32, 18),
    a('ayr', 'Ayr', 30, 18),

    // Wales
    a('cardiff', 'Cardiff', 36, 36),
    a('swansea', 'Swansea', 34, 36),
    a('newport', 'Newport', 36, 34),
    a('wrexham', 'Wrexham', 36, 28),
    a('bangor', 'Bangor', 34, 26),
    a('aberystwyth', 'Aberystwyth', 32, 30),

    // Northern Ireland
    a('belfast', 'Belfast', 16, 14),
    a('londonderry', 'Londonderry', 14, 12, 'derry'),
    a('lisburn', 'Lisburn', 16, 16),
    a('newry', 'Newry', 16, 18),
  ],
};

// De-duplicate by id
ukDataset.answers = ukDataset.answers.filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i);
