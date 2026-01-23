import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

import { addCoins, deductCoins, getDailyEarnings } from '../lib/coins.js';

const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Difficulty-based rewards (correct answers)
const REWARDS_BY_DIFFICULTY = {
    easy: 5,
    medium: 10,
    hard: 20
};

// Difficulty-based penalties (incorrect answers - inverse)
const PENALTIES_BY_DIFFICULTY = {
    easy: 20,    // Easy questions should be easy - big penalty for wrong
    medium: 10,  // Balanced
    hard: 5      // Hard questions are tough - small penalty for trying
};

const DAILY_TRIVIA_LIMIT = 20; // Max correct answers per day

// Philly sports trivia questions (exported for challenge engine)
export const TRIVIA_QUESTIONS = [
    // ==================== EAGLES ====================
    { _id: 'e1', team: 'Eagles', question: 'In what year did the Eagles win Super Bowl LII?', options: ['2017', '2018', '2019', '2020'], answer: '2018', difficulty: 'easy' },
    { _id: 'e2', team: 'Eagles', question: 'Who caught the famous "Philly Special" touchdown pass in Super Bowl LII?', options: ['Nick Foles', 'Zach Ertz', 'Alshon Jeffery', 'Trey Burton'], answer: 'Nick Foles', difficulty: 'medium' },
    { _id: 'e3', team: 'Eagles', question: 'What is the name of the Eagles mascot?', options: ['Swoop', 'Eddie Eagle', 'Philly', 'Wingman'], answer: 'Swoop', difficulty: 'easy' },
    { _id: 'e4', team: 'Eagles', question: 'Which Eagles player was known as "The Minister of Defense"?', options: ['Donovan McNabb', 'Randall Cunningham', 'Ron Jaworski', 'Reggie White'], answer: 'Reggie White', difficulty: 'hard' },
    { _id: 'e5', team: 'Eagles', question: 'How many NFL Championships have the Eagles won (including Super Bowls)?', options: ['2', '3', '4', '5'], answer: '4', difficulty: 'medium' },
    { _id: 'e6', team: 'Eagles', question: 'What year did Lincoln Financial Field open?', options: ['2001', '2003', '2005', '2007'], answer: '2003', difficulty: 'hard' },
    { _id: 'e7', team: 'Eagles', question: 'Who holds the Eagles record for most career rushing yards?', options: ['LeSean McCoy', 'Wilbert Montgomery', 'Brian Westbrook', 'Steve Van Buren'], answer: 'LeSean McCoy', difficulty: 'medium' },
    { _id: 'e8', team: 'Eagles', question: 'Which coach led the Eagles to their first Super Bowl appearance?', options: ['Dick Vermeil', 'Buddy Ryan', 'Andy Reid', 'Ray Rhodes'], answer: 'Dick Vermeil', difficulty: 'hard' },
    { _id: 'e9', team: 'Eagles', question: 'What jersey number did Brian Dawkins wear?', options: ['20', '36', '24', '21'], answer: '20', difficulty: 'easy' },
    { _id: 'e10', team: 'Eagles', question: 'Who was the Eagles head coach when they won Super Bowl LII?', options: ['Andy Reid', 'Chip Kelly', 'Doug Pederson', 'Nick Sirianni'], answer: 'Doug Pederson', difficulty: 'easy' },
    { _id: 'e11', team: 'Eagles', question: 'Which Eagles QB threw for 7 TDs in a single game in 2013?', options: ['Michael Vick', 'Nick Foles', 'Donovan McNabb', 'Carson Wentz'], answer: 'Nick Foles', difficulty: 'medium' },
    { _id: 'e12', team: 'Eagles', question: 'What year did the Eagles move to Veterans Stadium?', options: ['1971', '1973', '1975', '1977'], answer: '1971', difficulty: 'hard' },
    { _id: 'e13', team: 'Eagles', question: 'Who holds the Eagles record for most receiving yards in a season?', options: ['Terrell Owens', 'Mike Quick', 'DeSean Jackson', 'A.J. Brown'], answer: 'A.J. Brown', difficulty: 'hard' },
    { _id: 'e14', team: 'Eagles', question: 'Which Eagles running back was known as "Shady"?', options: ['Brian Westbrook', 'Duce Staley', 'LeSean McCoy', 'Miles Sanders'], answer: 'LeSean McCoy', difficulty: 'easy' },
    { _id: 'e15', team: 'Eagles', question: 'How many times did the Eagles appear in the NFC Championship under Andy Reid?', options: ['3', '4', '5', '6'], answer: '5', difficulty: 'hard' },
    { _id: 'e16', team: 'Eagles', question: 'Who was the MVP of Super Bowl LII?', options: ['Nick Foles', 'Zach Ertz', 'Fletcher Cox', 'Brandon Graham'], answer: 'Nick Foles', difficulty: 'easy' },
    { _id: 'e17', team: 'Eagles', question: 'Which Eagles defensive end strip-sacked Tom Brady in Super Bowl LII?', options: ['Chris Long', 'Brandon Graham', 'Fletcher Cox', 'Vinny Curry'], answer: 'Brandon Graham', difficulty: 'medium' },
    { _id: 'e18', team: 'Eagles', question: 'What is the name of the Eagles fight song?', options: ['Fly Eagles Fly', 'Eagle Pride', 'Go Birds', 'Wings of Victory'], answer: 'Fly Eagles Fly', difficulty: 'easy' },
    { _id: 'e19', team: 'Eagles', question: 'Who did the Eagles defeat in Super Bowl LVII?', options: ['Patriots', 'Chiefs', '49ers', 'Cowboys'], answer: 'Chiefs', difficulty: 'medium' },
    { _id: 'e20', team: 'Eagles', question: 'Which Eagles center was a key part of the 2017 Super Bowl team?', options: ['Jason Kelce', 'Jon Runyan', 'Jamaal Jackson', 'Hank Fraley'], answer: 'Jason Kelce', difficulty: 'easy' },

    // ==================== PHILLIES ====================
    { _id: 'p1', team: 'Phillies', question: 'In what year did the Phillies win their most recent World Series?', options: ['2008', '2009', '2010', '2011'], answer: '2008', difficulty: 'easy' },
    { _id: 'p2', team: 'Phillies', question: 'Who is the Phillies all-time home run leader?', options: ['Ryan Howard', 'Mike Schmidt', 'Chase Utley', 'Dick Allen'], answer: 'Mike Schmidt', difficulty: 'medium' },
    { _id: 'p3', team: 'Phillies', question: 'What is the name of the Phillies mascot?', options: ['Philly Phanatic', 'Phil E. Phan', 'Phred', 'Phrank'], answer: 'Philly Phanatic', difficulty: 'easy' },
    { _id: 'p4', team: 'Phillies', question: 'How many World Series have the Phillies won?', options: ['1', '2', '3', '4'], answer: '2', difficulty: 'medium' },
    { _id: 'p5', team: 'Phillies', question: 'Who threw the only perfect game in Phillies history?', options: ['Roy Halladay', 'Steve Carlton', 'Cole Hamels', 'Cliff Lee'], answer: 'Roy Halladay', difficulty: 'medium' },
    { _id: 'p6', team: 'Phillies', question: 'What year did Citizens Bank Park open?', options: ['2002', '2004', '2006', '2008'], answer: '2004', difficulty: 'hard' },
    { _id: 'p7', team: 'Phillies', question: 'Which Phillies pitcher won 4 Cy Young Awards?', options: ['Roy Halladay', 'Steve Carlton', 'Cole Hamels', 'Robin Roberts'], answer: 'Steve Carlton', difficulty: 'hard' },
    { _id: 'p8', team: 'Phillies', question: 'Who hit the walk-off home run to send the Phillies to the 2022 World Series?', options: ['Bryce Harper', 'Kyle Schwarber', 'Rhys Hoskins', 'J.T. Realmuto'], answer: 'Bryce Harper', difficulty: 'easy' },
    { _id: 'p9', team: 'Phillies', question: 'What jersey number did Mike Schmidt wear?', options: ['10', '20', '25', '45'], answer: '20', difficulty: 'easy' },
    { _id: 'p10', team: 'Phillies', question: 'Who was the Phillies manager during the 2008 World Series win?', options: ['Charlie Manuel', 'Larry Bowa', 'Terry Francona', 'Jim Fregosi'], answer: 'Charlie Manuel', difficulty: 'medium' },
    { _id: 'p11', team: 'Phillies', question: 'Which Phillies player hit 58 home runs in 2006?', options: ['Jim Thome', 'Ryan Howard', 'Chase Utley', 'Pat Burrell'], answer: 'Ryan Howard', difficulty: 'medium' },
    { _id: 'p12', team: 'Phillies', question: 'What year did the Phillies win their first World Series?', options: ['1915', '1929', '1950', '1980'], answer: '1980', difficulty: 'medium' },
    { _id: 'p13', team: 'Phillies', question: 'Who was known as "The Man" and wore #6 for the Phillies?', options: ['Ryan Howard', 'Chase Utley', 'Jimmy Rollins', 'Pat Burrell'], answer: 'Ryan Howard', difficulty: 'hard' },
    { _id: 'p14', team: 'Phillies', question: 'How many consecutive division titles did the Phillies win from 2007-2011?', options: ['3', '4', '5', '6'], answer: '5', difficulty: 'medium' },
    { _id: 'p15', team: 'Phillies', question: 'Who was the World Series MVP in 2008?', options: ['Ryan Howard', 'Cole Hamels', 'Chase Utley', 'Jimmy Rollins'], answer: 'Cole Hamels', difficulty: 'medium' },
    { _id: 'p16', team: 'Phillies', question: 'Which Phillies shortstop won MVP in 2007?', options: ['Jimmy Rollins', 'Chase Utley', 'Bobby Abreu', 'Scott Rolen'], answer: 'Jimmy Rollins', difficulty: 'medium' },
    { _id: 'p17', team: 'Phillies', question: 'What was the name of the Phillies stadium before Citizens Bank Park?', options: ['Veterans Stadium', 'Shibe Park', 'Baker Bowl', 'Connie Mack Stadium'], answer: 'Veterans Stadium', difficulty: 'easy' },
    { _id: 'p18', team: 'Phillies', question: 'Who holds the Phillies record for most hits in a season?', options: ['Chuck Klein', 'Richie Ashburn', 'Jimmy Rollins', 'Lenny Dykstra'], answer: 'Chuck Klein', difficulty: 'hard' },
    { _id: 'p19', team: 'Phillies', question: 'Which pitcher threw a no-hitter in the 2010 NLDS?', options: ['Cole Hamels', 'Roy Halladay', 'Cliff Lee', 'Roy Oswalt'], answer: 'Roy Halladay', difficulty: 'medium' },
    { _id: 'p20', team: 'Phillies', question: 'How many Gold Glove awards did Mike Schmidt win?', options: ['8', '10', '12', '14'], answer: '10', difficulty: 'hard' },

    // ==================== 76ERS ====================
    { _id: 's1', team: '76ers', question: 'How many NBA Championships have the 76ers won?', options: ['2', '3', '4', '5'], answer: '3', difficulty: 'medium' },
    { _id: 's2', team: '76ers', question: 'In what year did the 76ers win their most recent NBA Championship?', options: ['1980', '1983', '1985', '2001'], answer: '1983', difficulty: 'medium' },
    { _id: 's3', team: '76ers', question: 'Which 76ers player famously said "We talking about practice"?', options: ['Allen Iverson', 'Charles Barkley', 'Julius Erving', 'Moses Malone'], answer: 'Allen Iverson', difficulty: 'easy' },
    { _id: 's4', team: '76ers', question: 'What was the 76ers team called before moving to Philadelphia?', options: ['Syracuse Nationals', 'Baltimore Bullets', 'Rochester Royals', 'Fort Wayne Pistons'], answer: 'Syracuse Nationals', difficulty: 'hard' },
    { _id: 's5', team: '76ers', question: 'Who is known as "Dr. J"?', options: ['Julius Erving', 'Moses Malone', 'Charles Barkley', 'Allen Iverson'], answer: 'Julius Erving', difficulty: 'easy' },
    { _id: 's6', team: '76ers', question: 'What was the 76ers famous motto during the 2017-2019 rebuild?', options: ['Trust The Process', 'Believe', 'One Team', 'Phila United'], answer: 'Trust The Process', difficulty: 'easy' },
    { _id: 's7', team: '76ers', question: 'Which 76ers player holds the record for points in a single game with 68?', options: ['Allen Iverson', 'Wilt Chamberlain', 'Julius Erving', 'Joel Embiid'], answer: 'Wilt Chamberlain', difficulty: 'hard' },
    { _id: 's8', team: '76ers', question: 'What year did Allen Iverson win MVP?', options: ['2000', '2001', '2002', '2003'], answer: '2001', difficulty: 'medium' },
    { _id: 's9', team: '76ers', question: 'What jersey number did Allen Iverson wear?', options: ['1', '3', '11', '21'], answer: '3', difficulty: 'easy' },
    { _id: 's10', team: '76ers', question: 'Who predicted "Fo, Fo, Fo" for the 1983 playoffs?', options: ['Julius Erving', 'Moses Malone', 'Andrew Toney', 'Maurice Cheeks'], answer: 'Moses Malone', difficulty: 'medium' },
    { _id: 's11', team: '76ers', question: 'Which 76ers player was nicknamed "The Round Mound of Rebound"?', options: ['Moses Malone', 'Charles Barkley', 'Darryl Dawkins', 'Bobby Jones'], answer: 'Charles Barkley', difficulty: 'medium' },
    { _id: 's12', team: '76ers', question: 'What jersey number does Joel Embiid wear?', options: ['12', '21', '25', '33'], answer: '21', difficulty: 'easy' },
    { _id: 's13', team: '76ers', question: 'Who did the 76ers select with the #1 pick in 2016?', options: ['Joel Embiid', 'Ben Simmons', 'Markelle Fultz', 'Jahlil Okafor'], answer: 'Ben Simmons', difficulty: 'medium' },
    { _id: 's14', team: '76ers', question: 'Which 76ers center was known as "Chocolate Thunder"?', options: ['Wilt Chamberlain', 'Moses Malone', 'Darryl Dawkins', 'Shawn Bradley'], answer: 'Darryl Dawkins', difficulty: 'hard' },
    { _id: 's15', team: '76ers', question: 'How many scoring titles did Allen Iverson win?', options: ['2', '3', '4', '5'], answer: '4', difficulty: 'hard' },
    { _id: 's16', team: '76ers', question: 'Who coached the 76ers during the 2001 Finals run?', options: ['Larry Brown', 'Jim OBrien', 'Doug Collins', 'John Lucas'], answer: 'Larry Brown', difficulty: 'medium' },
    { _id: 's17', team: '76ers', question: 'What year did the 76ers move to Wells Fargo Center?', options: ['1994', '1996', '1998', '2000'], answer: '1996', difficulty: 'hard' },
    { _id: 's18', team: '76ers', question: 'Which 76ers player wore #6 and was known for his defense?', options: ['Bobby Jones', 'Maurice Cheeks', 'Andrew Toney', 'Caldwell Jones'], answer: 'Julius Erving', difficulty: 'hard' },
    { _id: 's19', team: '76ers', question: 'How many All-Star appearances did Julius Erving make as a 76er?', options: ['9', '10', '11', '12'], answer: '11', difficulty: 'hard' },
    { _id: 's20', team: '76ers', question: 'Who is the 76ers all-time leader in assists?', options: ['Allen Iverson', 'Maurice Cheeks', 'Hal Greer', 'Ben Simmons'], answer: 'Maurice Cheeks', difficulty: 'hard' },

    // ==================== FLYERS ====================
    { _id: 'f1', team: 'Flyers', question: 'How many Stanley Cups have the Flyers won?', options: ['1', '2', '3', '4'], answer: '2', difficulty: 'easy' },
    { _id: 'f2', team: 'Flyers', question: 'In what years did the Flyers win back-to-back Stanley Cups?', options: ['1972-1973', '1974-1975', '1976-1977', '1980-1981'], answer: '1974-1975', difficulty: 'medium' },
    { _id: 'f3', team: 'Flyers', question: 'What is the Flyers famous nickname?', options: ['Broad Street Bullies', 'Orange Crush', 'Philly Fighters', 'Ice Warriors'], answer: 'Broad Street Bullies', difficulty: 'easy' },
    { _id: 'f4', team: 'Flyers', question: 'Who is the Flyers all-time leading scorer?', options: ['Bobby Clarke', 'Bill Barber', 'Brian Propp', 'Eric Lindros'], answer: 'Bobby Clarke', difficulty: 'medium' },
    { _id: 'f5', team: 'Flyers', question: 'Which Flyers goalie is famous for his 35-game unbeaten streak?', options: ['Bernie Parent', 'Ron Hextall', 'Pelle Lindbergh', 'Brian Boucher'], answer: 'Bernie Parent', difficulty: 'hard' },
    { _id: 'f6', team: 'Flyers', question: 'What arena do the Flyers play in?', options: ['Wells Fargo Center', 'Lincoln Financial Field', 'Citizens Bank Park', 'Spectrum'], answer: 'Wells Fargo Center', difficulty: 'easy' },
    { _id: 'f7', team: 'Flyers', question: 'Which Flyers player wore #88 and was known as "The Big E"?', options: ['Eric Lindros', 'Eric Desjardins', 'Rod BrindAmour', 'John LeClair'], answer: 'Eric Lindros', difficulty: 'medium' },
    { _id: 'f8', team: 'Flyers', question: 'Who was the first Flyers captain?', options: ['Bobby Clarke', 'Lou Angotti', 'Ed Van Impe', 'Gary Dornhoefer'], answer: 'Lou Angotti', difficulty: 'hard' },
    { _id: 'f9', team: 'Flyers', question: 'What jersey number did Bobby Clarke wear?', options: ['14', '16', '17', '19'], answer: '16', difficulty: 'easy' },
    { _id: 'f10', team: 'Flyers', question: 'Which Flyers goalie won back-to-back Conn Smythe trophies?', options: ['Bernie Parent', 'Ron Hextall', 'Pelle Lindbergh', 'Roman Cechmanek'], answer: 'Bernie Parent', difficulty: 'medium' },
    { _id: 'f11', team: 'Flyers', question: 'What year were the Flyers established as an NHL team?', options: ['1965', '1967', '1969', '1971'], answer: '1967', difficulty: 'medium' },
    { _id: 'f12', team: 'Flyers', question: 'Who was the Flyers coach during both Stanley Cup wins?', options: ['Fred Shero', 'Pat Quinn', 'Mike Keenan', 'Keith Allen'], answer: 'Fred Shero', difficulty: 'medium' },
    { _id: 'f13', team: 'Flyers', question: 'Which Flyers winger was part of the "Legion of Doom" line?', options: ['Mark Recchi', 'John LeClair', 'Rod BrindAmour', 'Mikael Renberg'], answer: 'John LeClair', difficulty: 'medium' },
    { _id: 'f14', team: 'Flyers', question: 'Who holds the Flyers record for most goals in a season?', options: ['Reggie Leach', 'Tim Kerr', 'Bill Barber', 'Rick MacLeish'], answer: 'Reggie Leach', difficulty: 'hard' },
    { _id: 'f15', team: 'Flyers', question: 'Which Flyers defenseman was known for his fighting and scoring ability as a goalie?', options: ['Ron Hextall', 'Bernie Parent', 'Pelle Lindbergh', 'Steve Mason'], answer: 'Ron Hextall', difficulty: 'medium' },
    { _id: 'f16', team: 'Flyers', question: 'What was the name of the Flyers original arena?', options: ['The Spectrum', 'Wells Fargo Center', 'CoreStates Center', 'First Union Center'], answer: 'The Spectrum', difficulty: 'easy' },
    { _id: 'f17', team: 'Flyers', question: 'Who scored the Cup-winning goal in 1975?', options: ['Bobby Clarke', 'Bill Barber', 'Bob Kelly', 'Reggie Leach'], answer: 'Bob Kelly', difficulty: 'hard' },
    { _id: 'f18', team: 'Flyers', question: 'How many Hart Trophies did Bobby Clarke win?', options: ['1', '2', '3', '4'], answer: '3', difficulty: 'hard' },
    { _id: 'f19', team: 'Flyers', question: 'Which Flyers player wore #27 and was known as "The Hammer"?', options: ['Dave Schultz', 'Bob Kelly', 'Don Saleski', 'Andre Dupont'], answer: 'Dave Schultz', difficulty: 'hard' },
    { _id: 'f20', team: 'Flyers', question: 'What year did the Flyers lose to the Blackhawks in the Stanley Cup Finals?', options: ['2008', '2010', '2012', '2014'], answer: '2010', difficulty: 'medium' },

    // ==================== COLLEGE ====================
    { _id: 'col1', team: 'College', question: 'How many NCAA basketball championships has Villanova won?', options: ['1', '2', '3', '4'], answer: '3', difficulty: 'medium' },
    { _id: 'col2', team: 'College', question: 'Which Big 5 school did Jameer Nelson play for?', options: ['Villanova', 'Temple', 'Saint Joseph\'s', 'Penn'], answer: 'Saint Joseph\'s', difficulty: 'medium' },
    { _id: 'col3', team: 'College', question: 'Who hit the buzzer-beater to win Villanova\'s 2016 NCAA Championship?', options: ['Jalen Brunson', 'Kris Jenkins', 'Josh Hart', 'Ryan Arcidiacono'], answer: 'Kris Jenkins', difficulty: 'easy' },
    { _id: 'col4', team: 'College', question: 'Which Temple coach has the most wins in program history?', options: ['John Chaney', 'Fran Dunphy', 'Harry Litwack', 'Don Casey'], answer: 'John Chaney', difficulty: 'medium' },
    { _id: 'col5', team: 'College', question: 'What is the name of the Big 5 trophy awarded to the best team?', options: ['City Series Trophy', 'Big 5 Classic Trophy', 'Philadelphia Trophy', 'Palestra Cup'], answer: 'City Series Trophy', difficulty: 'hard' },
    { _id: 'col6', team: 'College', question: 'What arena is known as "The Cathedral of College Basketball"?', options: ['The Palestra', 'Wells Fargo Center', 'Liacouras Center', 'Finneran Pavilion'], answer: 'The Palestra', difficulty: 'easy' },
    { _id: 'col7', team: 'College', question: 'Which Big 5 team won the 1954 and 1955 NCAA championships?', options: ['Temple', 'La Salle', 'Villanova', 'Penn'], answer: 'La Salle', difficulty: 'hard' },
    { _id: 'col8', team: 'College', question: 'Who was Temple\'s legendary coach known for his zone defense?', options: ['John Chaney', 'Harry Litwack', 'Fran Dunphy', 'Don Casey'], answer: 'John Chaney', difficulty: 'easy' },
    { _id: 'col9', team: 'College', question: 'Which NBA star played at Villanova and was nicknamed "The Microwave"?', options: ['Kerry Kittles', 'Ed Pinckney', 'Kyle Lowry', 'Jalen Brunson'], answer: 'Kyle Lowry', difficulty: 'hard' },
    { _id: 'col10', team: 'College', question: 'What year did Villanova upset Georgetown to win their first NCAA title?', options: ['1983', '1985', '1987', '1989'], answer: '1985', difficulty: 'medium' },
    { _id: 'col11', team: 'College', question: 'Which Penn basketball team went undefeated in Ivy League play in 2018?', options: ['Men\'s Team', 'Women\'s Team', 'Both Teams', 'Neither Team'], answer: 'Women\'s Team', difficulty: 'hard' },
    { _id: 'col12', team: 'College', question: 'Who is Temple University named after?', options: ['A Greek Temple', 'Russell Conwell', 'No one specific', 'Benjamin Franklin'], answer: 'Russell Conwell', difficulty: 'hard' },
    { _id: 'col13', team: 'College', question: 'Which Villanova player won the 2018 National Championship MVP?', options: ['Jalen Brunson', 'Mikal Bridges', 'Donte DiVincenzo', 'Eric Paschall'], answer: 'Donte DiVincenzo', difficulty: 'medium' },
    { _id: 'col14', team: 'College', question: 'What is Drexel\'s team nickname?', options: ['Dragons', 'Owls', 'Hawks', 'Explorers'], answer: 'Dragons', difficulty: 'easy' },
    { _id: 'col15', team: 'College', question: 'Which Big 5 school is located in the Main Line suburbs?', options: ['Villanova', 'Saint Joseph\'s', 'La Salle', 'Penn'], answer: 'Villanova', difficulty: 'easy' },
    { _id: 'col16', team: 'College', question: 'How many Big 5 schools are there?', options: ['4', '5', '6', '7'], answer: '5', difficulty: 'easy' },
    { _id: 'col17', team: 'College', question: 'Which Saint Joseph\'s player was known as "Jameer the Great"?', options: ['Delonte West', 'Jameer Nelson', 'Pat Carroll', 'Langston Galloway'], answer: 'Jameer Nelson', difficulty: 'easy' },
    { _id: 'col18', team: 'College', question: 'What conference does Temple play in for football?', options: ['Big East', 'AAC', 'Big Ten', 'ACC'], answer: 'AAC', difficulty: 'medium' },
    { _id: 'col19', team: 'College', question: 'Which La Salle player is their all-time leading scorer?', options: ['Tom Gola', 'Lionel Simmons', 'Michael Brooks', 'Randy Woods'], answer: 'Lionel Simmons', difficulty: 'hard' },
    { _id: 'col20', team: 'College', question: 'What year was the Big 5 founded?', options: ['1945', '1955', '1965', '1975'], answer: '1955', difficulty: 'hard' },

    // ==================== GENERAL ====================
    { _id: 'gen1', team: 'General', question: 'Which arena hosts the 76ers, Flyers, and Wings?', options: ['Wells Fargo Center', 'Lincoln Financial Field', 'Citizens Bank Park', 'The Palestra'], answer: 'Wells Fargo Center', difficulty: 'easy' },
    { _id: 'gen2', team: 'General', question: 'What Philadelphia sports radio station is known as "The Fanatic"?', options: ['94.1 WIP', '97.5 The Fanatic', '94.5 PST', '610 ESPN'], answer: '97.5 The Fanatic', difficulty: 'easy' },
    { _id: 'gen3', team: 'General', question: 'Which Philly team was the last to win a championship before the Phillies in 2008?', options: ['Eagles', 'Flyers', '76ers', 'None since 1983'], answer: '76ers', difficulty: 'medium' },
    { _id: 'gen4', team: 'General', question: 'What year did Philadelphia host the NFL Draft?', options: ['2015', '2017', '2019', '2021'], answer: '2017', difficulty: 'medium' },
    { _id: 'gen5', team: 'General', question: 'Which Philadelphia stadium was imploded in 2004?', options: ['The Spectrum', 'Veterans Stadium', 'JFK Stadium', 'Convention Hall'], answer: 'Veterans Stadium', difficulty: 'easy' },
    { _id: 'gen6', team: 'General', question: 'What street is Lincoln Financial Field located on?', options: ['Broad Street', 'Pattison Avenue', 'Market Street', 'Chestnut Street'], answer: 'Pattison Avenue', difficulty: 'medium' },
    { _id: 'gen7', team: 'General', question: 'Which Philadelphia team had a mascot named "Big Shot"?', options: ['76ers', 'Phillies', 'Flyers', 'Eagles'], answer: '76ers', difficulty: 'hard' },
    { _id: 'gen8', team: 'General', question: 'What is the name of the Flyers\' female mascot?', options: ['Gritty Jr.', 'No female mascot', 'Gritty\'s Mom', 'Gritty is genderless'], answer: 'Gritty is genderless', difficulty: 'hard' },
    { _id: 'gen9', team: 'General', question: 'Which Philadelphia venue closed in 2009?', options: ['The Spectrum', 'Veterans Stadium', 'First Union Center', 'JFK Stadium'], answer: 'The Spectrum', difficulty: 'medium' },
    { _id: 'gen10', team: 'General', question: 'What Philadelphia team plays at Subaru Park?', options: ['Philadelphia Union', 'Philadelphia Wings', 'Philadelphia Soul', 'Philadelphia Fury'], answer: 'Philadelphia Union', difficulty: 'easy' },
    { _id: 'gen11', team: 'General', question: 'What is WIP Sports Radio\'s frequency?', options: ['94.1 FM', '97.5 FM', '610 AM', '1210 AM'], answer: '94.1 FM', difficulty: 'medium' },
    { _id: 'gen12', team: 'General', question: 'Which animal did Philadelphia fans once throw batteries at?', options: ['Santa Claus', 'J.D. Drew', 'Cowboys Fan', 'All of the above'], answer: 'J.D. Drew', difficulty: 'medium' },
    { _id: 'gen13', team: 'General', question: 'What year did Gritty become the Flyers mascot?', options: ['2016', '2017', '2018', '2019'], answer: '2018', difficulty: 'easy' },
    { _id: 'gen14', team: 'General', question: 'Which Philadelphia stadium had a courtroom and jail in the basement?', options: ['Veterans Stadium', 'Lincoln Financial Field', 'The Spectrum', 'JFK Stadium'], answer: 'Veterans Stadium', difficulty: 'easy' },
    { _id: 'gen15', team: 'General', question: 'What is the Philadelphia Union\'s home city?', options: ['Philadelphia', 'Chester', 'Camden', 'Wilmington'], answer: 'Chester', difficulty: 'medium' },
    { _id: 'gen16', team: 'General', question: 'Which broadcaster is known for calling "High Hopes" after Phillies wins?', options: ['Harry Kalas', 'Merrill Reese', 'Tom McCarthy', 'Scott Franzke'], answer: 'Harry Kalas', difficulty: 'easy' },
    { _id: 'gen17', team: 'General', question: 'What year did Philadelphia Eagles fans boo Santa Claus?', options: ['1965', '1968', '1971', '1974'], answer: '1968', difficulty: 'medium' },
    { _id: 'gen18', team: 'General', question: 'Which Philadelphia team\'s fans are known for "E-A-G-L-E-S" chant?', options: ['Eagles', 'All Philly teams', 'Phillies', '76ers'], answer: 'Eagles', difficulty: 'easy' },
    { _id: 'gen19', team: 'General', question: 'What is the name of the Phillies\' hall of fame?', options: ['Phillies Wall of Fame', 'Citizens Bank Hall', 'Philly Legends', 'Veterans Memorial'], answer: 'Phillies Wall of Fame', difficulty: 'medium' },
    { _id: 'gen20', team: 'General', question: 'How many major professional sports teams does Philadelphia have?', options: ['4', '5', '6', '7'], answer: '5', difficulty: 'medium' }
];

export default async function handler(req, res) {
    const token = req.cookies?.auth_token;

    if (req.method === 'GET') {
        // Get a random question
        const team = req.query.team; // Optional filter by team
        let questions = TRIVIA_QUESTIONS;

        if (team) {
            questions = questions.filter(q => q.team === team);
        }

        // If user is logged in, filter out questions they've answered today
        let answeredToday = [];
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                const client = new MongoClient(uri);
                await client.connect();
                const db = client.db('phillysports');

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const todayAnswers = await db.collection('trivia_answers')
                    .find({
                        userId: new ObjectId(decoded.userId),
                        answeredAt: { $gte: today }
                    })
                    .toArray();

                answeredToday = todayAnswers.map(a => a.questionId);
                await client.close();
            } catch (e) {
                // Ignore auth errors for question fetching
            }
        }

        // Filter out already answered questions
        const availableQuestions = questions.filter(q => !answeredToday.includes(q._id));

        if (availableQuestions.length === 0) {
            return res.status(200).json({
                success: true,
                question: null,
                message: team
                    ? `You've answered all ${team} questions for today! Try another team or come back tomorrow.`
                    : "You've answered all questions for today! Come back tomorrow for more."
            });
        }

        // Pick a random question
        const randomQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

        // Don't send the answer to the client
        const { answer, ...questionWithoutAnswer } = randomQuestion;

        return res.status(200).json({
            success: true,
            question: questionWithoutAnswer,
            remainingToday: availableQuestions.length
        });
    }

    if (req.method === 'POST') {
        // Submit an answer
        if (!token) {
            return res.status(401).json({ error: 'Login required to earn Diehard Dollars' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const { questionId, selectedAnswer } = req.body;

        if (!questionId || !selectedAnswer) {
            return res.status(400).json({ error: 'Question ID and answer required' });
        }

        // Find the question
        const question = TRIVIA_QUESTIONS.find(q => q._id === questionId);
        if (!question) {
            return res.status(404).json({ error: 'Question not found' });
        }

        const client = new MongoClient(uri);

        try {
            await client.connect();
            const db = client.db('phillysports');
            const answersCollection = db.collection('trivia_answers');

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Check if already answered this question today
            const existingAnswer = await answersCollection.findOne({
                userId: new ObjectId(decoded.userId),
                questionId: questionId,
                answeredAt: { $gte: today }
            });

            if (existingAnswer) {
                return res.status(400).json({ error: 'You already answered this question today' });
            }

            // Check daily limit
            const dailyCorrect = await answersCollection.countDocuments({
                userId: new ObjectId(decoded.userId),
                correct: true,
                answeredAt: { $gte: today }
            });

            const isCorrect = selectedAnswer === question.answer;
            const difficulty = question.difficulty || 'medium';
            let coinsEarned = 0;
            let coinsLost = 0;

            // Record the answer
            await answersCollection.insertOne({
                userId: new ObjectId(decoded.userId),
                questionId: questionId,
                selectedAnswer,
                correct: isCorrect,
                difficulty: difficulty,
                answeredAt: new Date()
            });

            if (isCorrect) {
                // Award coins based on difficulty (if under daily limit)
                if (dailyCorrect < DAILY_TRIVIA_LIMIT) {
                    const reward = REWARDS_BY_DIFFICULTY[difficulty] || 10;
                    await addCoins(
                        decoded.userId,
                        reward,
                        'trivia',
                        `Correct ${difficulty} trivia: ${question.team}`,
                        { questionId, team: question.team, difficulty }
                    );
                    coinsEarned = reward;
                }
            } else {
                // Deduct coins based on difficulty (inverse - easy wrong = big penalty)
                const penalty = PENALTIES_BY_DIFFICULTY[difficulty] || 10;
                const result = await deductCoins(
                    decoded.userId,
                    penalty,
                    'trivia_penalty',
                    `Incorrect ${difficulty} trivia: ${question.team}`,
                    { questionId, team: question.team, difficulty }
                );
                coinsLost = typeof result === 'object' ? result.deducted : 0;
            }

            // Get updated stats
            const totalCorrect = await answersCollection.countDocuments({
                userId: new ObjectId(decoded.userId),
                correct: true
            });

            const totalAnswered = await answersCollection.countDocuments({
                userId: new ObjectId(decoded.userId)
            });

            // Get updated balance
            const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });

            res.status(200).json({
                success: true,
                correct: isCorrect,
                correctAnswer: question.answer,
                difficulty: difficulty,
                coinsEarned,
                coinsLost,
                dailyCorrect: dailyCorrect + (isCorrect ? 1 : 0),
                dailyLimit: DAILY_TRIVIA_LIMIT,
                stats: {
                    totalCorrect,
                    totalAnswered,
                    accuracy: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0
                },
                newBalance: user?.coinBalance || 0
            });
        } catch (error) {
            console.error('Trivia answer error:', error);
            res.status(500).json({ error: 'Failed to submit answer' });
        } finally {
            await client.close();
        }
        return;
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
