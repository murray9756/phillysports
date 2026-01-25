// Migrate hardcoded trivia questions to database
// POST: Run migration (one-time)
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

// Original hardcoded questions from the trivia API
const LEGACY_QUESTIONS = [
    // ==================== EAGLES ====================
    { legacyId: 'e1', category: 'Eagles', question: 'In what year did the Eagles win Super Bowl LII?', options: ['2017', '2018', '2019', '2020'], answer: '2018', difficulty: 'easy' },
    { legacyId: 'e2', category: 'Eagles', question: 'Who caught the famous "Philly Special" touchdown pass in Super Bowl LII?', options: ['Nick Foles', 'Zach Ertz', 'Alshon Jeffery', 'Trey Burton'], answer: 'Nick Foles', difficulty: 'medium' },
    { legacyId: 'e3', category: 'Eagles', question: 'What is the name of the Eagles mascot?', options: ['Swoop', 'Eddie Eagle', 'Philly', 'Wingman'], answer: 'Swoop', difficulty: 'easy' },
    { legacyId: 'e4', category: 'Eagles', question: 'Which Eagles player was known as "The Minister of Defense"?', options: ['Donovan McNabb', 'Randall Cunningham', 'Ron Jaworski', 'Reggie White'], answer: 'Reggie White', difficulty: 'hard' },
    { legacyId: 'e5', category: 'Eagles', question: 'How many NFL Championships have the Eagles won (including Super Bowls)?', options: ['2', '3', '4', '5'], answer: '4', difficulty: 'medium' },
    { legacyId: 'e6', category: 'Eagles', question: 'What year did Lincoln Financial Field open?', options: ['2001', '2003', '2005', '2007'], answer: '2003', difficulty: 'hard' },
    { legacyId: 'e7', category: 'Eagles', question: 'Who holds the Eagles record for most career rushing yards?', options: ['LeSean McCoy', 'Wilbert Montgomery', 'Brian Westbrook', 'Steve Van Buren'], answer: 'LeSean McCoy', difficulty: 'medium' },
    { legacyId: 'e8', category: 'Eagles', question: 'Which coach led the Eagles to their first Super Bowl appearance?', options: ['Dick Vermeil', 'Buddy Ryan', 'Andy Reid', 'Ray Rhodes'], answer: 'Dick Vermeil', difficulty: 'hard' },
    { legacyId: 'e9', category: 'Eagles', question: 'What jersey number did Brian Dawkins wear?', options: ['20', '36', '24', '21'], answer: '20', difficulty: 'easy' },
    { legacyId: 'e10', category: 'Eagles', question: 'Who was the Eagles head coach when they won Super Bowl LII?', options: ['Andy Reid', 'Chip Kelly', 'Doug Pederson', 'Nick Sirianni'], answer: 'Doug Pederson', difficulty: 'easy' },
    { legacyId: 'e11', category: 'Eagles', question: 'Which Eagles QB threw for 7 TDs in a single game in 2013?', options: ['Michael Vick', 'Nick Foles', 'Donovan McNabb', 'Carson Wentz'], answer: 'Nick Foles', difficulty: 'medium' },
    { legacyId: 'e12', category: 'Eagles', question: 'What year did the Eagles move to Veterans Stadium?', options: ['1971', '1973', '1975', '1977'], answer: '1971', difficulty: 'hard' },
    { legacyId: 'e13', category: 'Eagles', question: 'Who holds the Eagles record for most receiving yards in a season?', options: ['Terrell Owens', 'Mike Quick', 'DeSean Jackson', 'A.J. Brown'], answer: 'A.J. Brown', difficulty: 'hard' },
    { legacyId: 'e14', category: 'Eagles', question: 'Which Eagles running back was known as "Shady"?', options: ['Brian Westbrook', 'Duce Staley', 'LeSean McCoy', 'Miles Sanders'], answer: 'LeSean McCoy', difficulty: 'easy' },
    { legacyId: 'e15', category: 'Eagles', question: 'How many times did the Eagles appear in the NFC Championship under Andy Reid?', options: ['3', '4', '5', '6'], answer: '5', difficulty: 'hard' },
    { legacyId: 'e16', category: 'Eagles', question: 'Who was the MVP of Super Bowl LII?', options: ['Nick Foles', 'Zach Ertz', 'Fletcher Cox', 'Brandon Graham'], answer: 'Nick Foles', difficulty: 'easy' },
    { legacyId: 'e17', category: 'Eagles', question: 'Which Eagles defensive end strip-sacked Tom Brady in Super Bowl LII?', options: ['Chris Long', 'Brandon Graham', 'Fletcher Cox', 'Vinny Curry'], answer: 'Brandon Graham', difficulty: 'medium' },
    { legacyId: 'e18', category: 'Eagles', question: 'What is the name of the Eagles fight song?', options: ['Fly Eagles Fly', 'Eagle Pride', 'Go Birds', 'Wings of Victory'], answer: 'Fly Eagles Fly', difficulty: 'easy' },
    { legacyId: 'e19', category: 'Eagles', question: 'Who did the Eagles defeat in Super Bowl LVII?', options: ['Patriots', 'Chiefs', '49ers', 'Cowboys'], answer: 'Chiefs', difficulty: 'medium' },
    { legacyId: 'e20', category: 'Eagles', question: 'Which Eagles center was a key part of the 2017 Super Bowl team?', options: ['Jason Kelce', 'Jon Runyan', 'Jamaal Jackson', 'Hank Fraley'], answer: 'Jason Kelce', difficulty: 'easy' },

    // ==================== PHILLIES ====================
    { legacyId: 'p1', category: 'Phillies', question: 'In what year did the Phillies win their most recent World Series?', options: ['2008', '2009', '2010', '2011'], answer: '2008', difficulty: 'easy' },
    { legacyId: 'p2', category: 'Phillies', question: 'Who is the Phillies all-time home run leader?', options: ['Ryan Howard', 'Mike Schmidt', 'Chase Utley', 'Dick Allen'], answer: 'Mike Schmidt', difficulty: 'medium' },
    { legacyId: 'p3', category: 'Phillies', question: 'What is the name of the Phillies mascot?', options: ['Philly Phanatic', 'Phil E. Phan', 'Phred', 'Phrank'], answer: 'Philly Phanatic', difficulty: 'easy' },
    { legacyId: 'p4', category: 'Phillies', question: 'How many World Series have the Phillies won?', options: ['1', '2', '3', '4'], answer: '2', difficulty: 'medium' },
    { legacyId: 'p5', category: 'Phillies', question: 'Who threw the only perfect game in Phillies history?', options: ['Roy Halladay', 'Steve Carlton', 'Cole Hamels', 'Cliff Lee'], answer: 'Roy Halladay', difficulty: 'medium' },
    { legacyId: 'p6', category: 'Phillies', question: 'What year did Citizens Bank Park open?', options: ['2002', '2004', '2006', '2008'], answer: '2004', difficulty: 'hard' },
    { legacyId: 'p7', category: 'Phillies', question: 'Which Phillies pitcher won 4 Cy Young Awards?', options: ['Roy Halladay', 'Steve Carlton', 'Cole Hamels', 'Robin Roberts'], answer: 'Steve Carlton', difficulty: 'hard' },
    { legacyId: 'p8', category: 'Phillies', question: 'Who hit the walk-off home run to send the Phillies to the 2022 World Series?', options: ['Bryce Harper', 'Kyle Schwarber', 'Rhys Hoskins', 'J.T. Realmuto'], answer: 'Bryce Harper', difficulty: 'easy' },
    { legacyId: 'p9', category: 'Phillies', question: 'What jersey number did Mike Schmidt wear?', options: ['10', '20', '25', '45'], answer: '20', difficulty: 'easy' },
    { legacyId: 'p10', category: 'Phillies', question: 'Who was the Phillies manager during the 2008 World Series win?', options: ['Charlie Manuel', 'Larry Bowa', 'Terry Francona', 'Jim Fregosi'], answer: 'Charlie Manuel', difficulty: 'medium' },
    { legacyId: 'p11', category: 'Phillies', question: 'Which Phillies player hit 58 home runs in 2006?', options: ['Jim Thome', 'Ryan Howard', 'Chase Utley', 'Pat Burrell'], answer: 'Ryan Howard', difficulty: 'medium' },
    { legacyId: 'p12', category: 'Phillies', question: 'What year did the Phillies win their first World Series?', options: ['1915', '1929', '1950', '1980'], answer: '1980', difficulty: 'medium' },
    { legacyId: 'p13', category: 'Phillies', question: 'Who was known as "The Man" and wore #6 for the Phillies?', options: ['Ryan Howard', 'Chase Utley', 'Jimmy Rollins', 'Pat Burrell'], answer: 'Ryan Howard', difficulty: 'hard' },
    { legacyId: 'p14', category: 'Phillies', question: 'How many consecutive division titles did the Phillies win from 2007-2011?', options: ['3', '4', '5', '6'], answer: '5', difficulty: 'medium' },
    { legacyId: 'p15', category: 'Phillies', question: 'Who was the World Series MVP in 2008?', options: ['Ryan Howard', 'Cole Hamels', 'Chase Utley', 'Jimmy Rollins'], answer: 'Cole Hamels', difficulty: 'medium' },
    { legacyId: 'p16', category: 'Phillies', question: 'Which Phillies shortstop won MVP in 2007?', options: ['Jimmy Rollins', 'Chase Utley', 'Bobby Abreu', 'Scott Rolen'], answer: 'Jimmy Rollins', difficulty: 'medium' },
    { legacyId: 'p17', category: 'Phillies', question: 'What was the name of the Phillies stadium before Citizens Bank Park?', options: ['Veterans Stadium', 'Shibe Park', 'Baker Bowl', 'Connie Mack Stadium'], answer: 'Veterans Stadium', difficulty: 'easy' },
    { legacyId: 'p18', category: 'Phillies', question: 'Who holds the Phillies record for most hits in a season?', options: ['Chuck Klein', 'Richie Ashburn', 'Jimmy Rollins', 'Lenny Dykstra'], answer: 'Chuck Klein', difficulty: 'hard' },
    { legacyId: 'p19', category: 'Phillies', question: 'Which pitcher threw a no-hitter in the 2010 NLDS?', options: ['Cole Hamels', 'Roy Halladay', 'Cliff Lee', 'Roy Oswalt'], answer: 'Roy Halladay', difficulty: 'medium' },
    { legacyId: 'p20', category: 'Phillies', question: 'How many Gold Glove awards did Mike Schmidt win?', options: ['8', '10', '12', '14'], answer: '10', difficulty: 'hard' },

    // ==================== 76ERS ====================
    { legacyId: 's1', category: '76ers', question: 'How many NBA Championships have the 76ers won?', options: ['2', '3', '4', '5'], answer: '3', difficulty: 'medium' },
    { legacyId: 's2', category: '76ers', question: 'In what year did the 76ers win their most recent NBA Championship?', options: ['1980', '1983', '1985', '2001'], answer: '1983', difficulty: 'medium' },
    { legacyId: 's3', category: '76ers', question: 'Which 76ers player famously said "We talking about practice"?', options: ['Allen Iverson', 'Charles Barkley', 'Julius Erving', 'Moses Malone'], answer: 'Allen Iverson', difficulty: 'easy' },
    { legacyId: 's4', category: '76ers', question: 'What was the 76ers team called before moving to Philadelphia?', options: ['Syracuse Nationals', 'Baltimore Bullets', 'Rochester Royals', 'Fort Wayne Pistons'], answer: 'Syracuse Nationals', difficulty: 'hard' },
    { legacyId: 's5', category: '76ers', question: 'Who is known as "Dr. J"?', options: ['Julius Erving', 'Moses Malone', 'Charles Barkley', 'Allen Iverson'], answer: 'Julius Erving', difficulty: 'easy' },
    { legacyId: 's6', category: '76ers', question: 'What was the 76ers famous motto during the 2017-2019 rebuild?', options: ['Trust The Process', 'Believe', 'One Team', 'Phila United'], answer: 'Trust The Process', difficulty: 'easy' },
    { legacyId: 's7', category: '76ers', question: 'Which 76ers player holds the record for points in a single game with 68?', options: ['Allen Iverson', 'Wilt Chamberlain', 'Julius Erving', 'Joel Embiid'], answer: 'Wilt Chamberlain', difficulty: 'hard' },
    { legacyId: 's8', category: '76ers', question: 'What year did Allen Iverson win MVP?', options: ['2000', '2001', '2002', '2003'], answer: '2001', difficulty: 'medium' },
    { legacyId: 's9', category: '76ers', question: 'What jersey number did Allen Iverson wear?', options: ['1', '3', '11', '21'], answer: '3', difficulty: 'easy' },
    { legacyId: 's10', category: '76ers', question: 'Who predicted "Fo, Fo, Fo" for the 1983 playoffs?', options: ['Julius Erving', 'Moses Malone', 'Andrew Toney', 'Maurice Cheeks'], answer: 'Moses Malone', difficulty: 'medium' },
    { legacyId: 's11', category: '76ers', question: 'Which 76ers player was nicknamed "The Round Mound of Rebound"?', options: ['Moses Malone', 'Charles Barkley', 'Darryl Dawkins', 'Bobby Jones'], answer: 'Charles Barkley', difficulty: 'medium' },
    { legacyId: 's12', category: '76ers', question: 'What jersey number does Joel Embiid wear?', options: ['12', '21', '25', '33'], answer: '21', difficulty: 'easy' },
    { legacyId: 's13', category: '76ers', question: 'Who did the 76ers select with the #1 pick in 2016?', options: ['Joel Embiid', 'Ben Simmons', 'Markelle Fultz', 'Jahlil Okafor'], answer: 'Ben Simmons', difficulty: 'medium' },
    { legacyId: 's14', category: '76ers', question: 'Which 76ers center was known as "Chocolate Thunder"?', options: ['Wilt Chamberlain', 'Moses Malone', 'Darryl Dawkins', 'Shawn Bradley'], answer: 'Darryl Dawkins', difficulty: 'hard' },
    { legacyId: 's15', category: '76ers', question: 'How many scoring titles did Allen Iverson win?', options: ['2', '3', '4', '5'], answer: '4', difficulty: 'hard' },
    { legacyId: 's16', category: '76ers', question: 'Who coached the 76ers during the 2001 Finals run?', options: ['Larry Brown', 'Jim OBrien', 'Doug Collins', 'John Lucas'], answer: 'Larry Brown', difficulty: 'medium' },
    { legacyId: 's17', category: '76ers', question: 'What year did the 76ers move to Wells Fargo Center?', options: ['1994', '1996', '1998', '2000'], answer: '1996', difficulty: 'hard' },
    { legacyId: 's18', category: '76ers', question: 'Which 76ers player wore #6 and was known for his defense?', options: ['Bobby Jones', 'Maurice Cheeks', 'Andrew Toney', 'Caldwell Jones'], answer: 'Julius Erving', difficulty: 'hard' },
    { legacyId: 's19', category: '76ers', question: 'How many All-Star appearances did Julius Erving make as a 76er?', options: ['9', '10', '11', '12'], answer: '11', difficulty: 'hard' },
    { legacyId: 's20', category: '76ers', question: 'Who is the 76ers all-time leader in assists?', options: ['Allen Iverson', 'Maurice Cheeks', 'Hal Greer', 'Ben Simmons'], answer: 'Maurice Cheeks', difficulty: 'hard' },

    // ==================== FLYERS ====================
    { legacyId: 'f1', category: 'Flyers', question: 'How many Stanley Cups have the Flyers won?', options: ['1', '2', '3', '4'], answer: '2', difficulty: 'easy' },
    { legacyId: 'f2', category: 'Flyers', question: 'In what years did the Flyers win back-to-back Stanley Cups?', options: ['1972-1973', '1974-1975', '1976-1977', '1980-1981'], answer: '1974-1975', difficulty: 'medium' },
    { legacyId: 'f3', category: 'Flyers', question: 'What is the Flyers famous nickname?', options: ['Broad Street Bullies', 'Orange Crush', 'Philly Fighters', 'Ice Warriors'], answer: 'Broad Street Bullies', difficulty: 'easy' },
    { legacyId: 'f4', category: 'Flyers', question: 'Who is the Flyers all-time leading scorer?', options: ['Bobby Clarke', 'Bill Barber', 'Brian Propp', 'Eric Lindros'], answer: 'Bobby Clarke', difficulty: 'medium' },
    { legacyId: 'f5', category: 'Flyers', question: 'Which Flyers goalie is famous for his 35-game unbeaten streak?', options: ['Bernie Parent', 'Ron Hextall', 'Pelle Lindbergh', 'Brian Boucher'], answer: 'Bernie Parent', difficulty: 'hard' },
    { legacyId: 'f6', category: 'Flyers', question: 'What arena do the Flyers play in?', options: ['Wells Fargo Center', 'Lincoln Financial Field', 'Citizens Bank Park', 'Spectrum'], answer: 'Wells Fargo Center', difficulty: 'easy' },
    { legacyId: 'f7', category: 'Flyers', question: 'Which Flyers player wore #88 and was known as "The Big E"?', options: ['Eric Lindros', 'Eric Desjardins', 'Rod BrindAmour', 'John LeClair'], answer: 'Eric Lindros', difficulty: 'medium' },
    { legacyId: 'f8', category: 'Flyers', question: 'Who was the first Flyers captain?', options: ['Bobby Clarke', 'Lou Angotti', 'Ed Van Impe', 'Gary Dornhoefer'], answer: 'Lou Angotti', difficulty: 'hard' },
    { legacyId: 'f9', category: 'Flyers', question: 'What jersey number did Bobby Clarke wear?', options: ['14', '16', '17', '19'], answer: '16', difficulty: 'easy' },
    { legacyId: 'f10', category: 'Flyers', question: 'Which Flyers goalie won back-to-back Conn Smythe trophies?', options: ['Bernie Parent', 'Ron Hextall', 'Pelle Lindbergh', 'Roman Cechmanek'], answer: 'Bernie Parent', difficulty: 'medium' },
    { legacyId: 'f11', category: 'Flyers', question: 'What year were the Flyers established as an NHL team?', options: ['1965', '1967', '1969', '1971'], answer: '1967', difficulty: 'medium' },
    { legacyId: 'f12', category: 'Flyers', question: 'Who was the Flyers coach during both Stanley Cup wins?', options: ['Fred Shero', 'Pat Quinn', 'Mike Keenan', 'Keith Allen'], answer: 'Fred Shero', difficulty: 'medium' },
    { legacyId: 'f13', category: 'Flyers', question: 'Which Flyers winger was part of the "Legion of Doom" line?', options: ['Mark Recchi', 'John LeClair', 'Rod BrindAmour', 'Mikael Renberg'], answer: 'John LeClair', difficulty: 'medium' },
    { legacyId: 'f14', category: 'Flyers', question: 'Who holds the Flyers record for most goals in a season?', options: ['Reggie Leach', 'Tim Kerr', 'Bill Barber', 'Rick MacLeish'], answer: 'Reggie Leach', difficulty: 'hard' },
    { legacyId: 'f15', category: 'Flyers', question: 'Which Flyers defenseman was known for his fighting and scoring ability as a goalie?', options: ['Ron Hextall', 'Bernie Parent', 'Pelle Lindbergh', 'Steve Mason'], answer: 'Ron Hextall', difficulty: 'medium' },
    { legacyId: 'f16', category: 'Flyers', question: 'What was the name of the Flyers original arena?', options: ['The Spectrum', 'Wells Fargo Center', 'CoreStates Center', 'First Union Center'], answer: 'The Spectrum', difficulty: 'easy' },
    { legacyId: 'f17', category: 'Flyers', question: 'Who scored the Cup-winning goal in 1975?', options: ['Bobby Clarke', 'Bill Barber', 'Bob Kelly', 'Reggie Leach'], answer: 'Bob Kelly', difficulty: 'hard' },
    { legacyId: 'f18', category: 'Flyers', question: 'How many Hart Trophies did Bobby Clarke win?', options: ['1', '2', '3', '4'], answer: '3', difficulty: 'hard' },
    { legacyId: 'f19', category: 'Flyers', question: 'Which Flyers player wore #27 and was known as "The Hammer"?', options: ['Dave Schultz', 'Bob Kelly', 'Don Saleski', 'Andre Dupont'], answer: 'Dave Schultz', difficulty: 'hard' },
    { legacyId: 'f20', category: 'Flyers', question: 'What year did the Flyers lose to the Blackhawks in the Stanley Cup Finals?', options: ['2008', '2010', '2012', '2014'], answer: '2010', difficulty: 'medium' },

    // ==================== COLLEGE ====================
    { legacyId: 'col1', category: 'College', question: 'How many NCAA basketball championships has Villanova won?', options: ['1', '2', '3', '4'], answer: '3', difficulty: 'medium' },
    { legacyId: 'col2', category: 'College', question: 'Which Big 5 school did Jameer Nelson play for?', options: ['Villanova', 'Temple', "Saint Joseph's", 'Penn'], answer: "Saint Joseph's", difficulty: 'medium' },
    { legacyId: 'col3', category: 'College', question: "Who hit the buzzer-beater to win Villanova's 2016 NCAA Championship?", options: ['Jalen Brunson', 'Kris Jenkins', 'Josh Hart', 'Ryan Arcidiacono'], answer: 'Kris Jenkins', difficulty: 'easy' },
    { legacyId: 'col4', category: 'College', question: 'Which Temple coach has the most wins in program history?', options: ['John Chaney', 'Fran Dunphy', 'Harry Litwack', 'Don Casey'], answer: 'John Chaney', difficulty: 'medium' },
    { legacyId: 'col5', category: 'College', question: 'What is the name of the Big 5 trophy awarded to the best team?', options: ['City Series Trophy', 'Big 5 Classic Trophy', 'Philadelphia Trophy', 'Palestra Cup'], answer: 'City Series Trophy', difficulty: 'hard' },
    { legacyId: 'col6', category: 'College', question: 'What arena is known as "The Cathedral of College Basketball"?', options: ['The Palestra', 'Wells Fargo Center', 'Liacouras Center', 'Finneran Pavilion'], answer: 'The Palestra', difficulty: 'easy' },
    { legacyId: 'col7', category: 'College', question: 'Which Big 5 team won the 1954 and 1955 NCAA championships?', options: ['Temple', 'La Salle', 'Villanova', 'Penn'], answer: 'La Salle', difficulty: 'hard' },
    { legacyId: 'col8', category: 'College', question: "Who was Temple's legendary coach known for his zone defense?", options: ['John Chaney', 'Harry Litwack', 'Fran Dunphy', 'Don Casey'], answer: 'John Chaney', difficulty: 'easy' },
    { legacyId: 'col9', category: 'College', question: 'Which NBA star played at Villanova and was nicknamed "The Microwave"?', options: ['Kerry Kittles', 'Ed Pinckney', 'Kyle Lowry', 'Jalen Brunson'], answer: 'Kyle Lowry', difficulty: 'hard' },
    { legacyId: 'col10', category: 'College', question: 'What year did Villanova upset Georgetown to win their first NCAA title?', options: ['1983', '1985', '1987', '1989'], answer: '1985', difficulty: 'medium' },
    { legacyId: 'col11', category: 'College', question: 'Which Penn basketball team went undefeated in Ivy League play in 2018?', options: ["Men's Team", "Women's Team", 'Both Teams', 'Neither Team'], answer: "Women's Team", difficulty: 'hard' },
    { legacyId: 'col12', category: 'College', question: 'Who is Temple University named after?', options: ['A Greek Temple', 'Russell Conwell', 'No one specific', 'Benjamin Franklin'], answer: 'Russell Conwell', difficulty: 'hard' },
    { legacyId: 'col13', category: 'College', question: 'Which Villanova player won the 2018 National Championship MVP?', options: ['Jalen Brunson', 'Mikal Bridges', 'Donte DiVincenzo', 'Eric Paschall'], answer: 'Donte DiVincenzo', difficulty: 'medium' },
    { legacyId: 'col14', category: 'College', question: "What is Drexel's team nickname?", options: ['Dragons', 'Owls', 'Hawks', 'Explorers'], answer: 'Dragons', difficulty: 'easy' },
    { legacyId: 'col15', category: 'College', question: 'Which Big 5 school is located in the Main Line suburbs?', options: ['Villanova', "Saint Joseph's", 'La Salle', 'Penn'], answer: 'Villanova', difficulty: 'easy' },
    { legacyId: 'col16', category: 'College', question: 'How many Big 5 schools are there?', options: ['4', '5', '6', '7'], answer: '5', difficulty: 'easy' },
    { legacyId: 'col17', category: 'College', question: "Which Saint Joseph's player was known as \"Jameer the Great\"?", options: ['Delonte West', 'Jameer Nelson', 'Pat Carroll', 'Langston Galloway'], answer: 'Jameer Nelson', difficulty: 'easy' },
    { legacyId: 'col18', category: 'College', question: 'What conference does Temple play in for football?', options: ['Big East', 'AAC', 'Big Ten', 'ACC'], answer: 'AAC', difficulty: 'medium' },
    { legacyId: 'col19', category: 'College', question: 'Which La Salle player is their all-time leading scorer?', options: ['Tom Gola', 'Lionel Simmons', 'Michael Brooks', 'Randy Woods'], answer: 'Lionel Simmons', difficulty: 'hard' },
    { legacyId: 'col20', category: 'College', question: 'What year was the Big 5 founded?', options: ['1945', '1955', '1965', '1975'], answer: '1955', difficulty: 'hard' },

    // ==================== GENERAL ====================
    { legacyId: 'gen1', category: 'General', question: 'Which arena hosts the 76ers, Flyers, and Wings?', options: ['Wells Fargo Center', 'Lincoln Financial Field', 'Citizens Bank Park', 'The Palestra'], answer: 'Wells Fargo Center', difficulty: 'easy' },
    { legacyId: 'gen2', category: 'General', question: 'What Philadelphia sports radio station is known as "The Fanatic"?', options: ['94.1 WIP', '97.5 The Fanatic', '94.5 PST', '610 ESPN'], answer: '97.5 The Fanatic', difficulty: 'easy' },
    { legacyId: 'gen3', category: 'General', question: 'Which Philly team was the last to win a championship before the Phillies in 2008?', options: ['Eagles', 'Flyers', '76ers', 'None since 1983'], answer: '76ers', difficulty: 'medium' },
    { legacyId: 'gen4', category: 'General', question: 'What year did Philadelphia host the NFL Draft?', options: ['2015', '2017', '2019', '2021'], answer: '2017', difficulty: 'medium' },
    { legacyId: 'gen5', category: 'General', question: 'Which Philadelphia stadium was imploded in 2004?', options: ['The Spectrum', 'Veterans Stadium', 'JFK Stadium', 'Convention Hall'], answer: 'Veterans Stadium', difficulty: 'easy' },
    { legacyId: 'gen6', category: 'General', question: 'What street is Lincoln Financial Field located on?', options: ['Broad Street', 'Pattison Avenue', 'Market Street', 'Chestnut Street'], answer: 'Pattison Avenue', difficulty: 'medium' },
    { legacyId: 'gen7', category: 'General', question: 'Which Philadelphia team had a mascot named "Big Shot"?', options: ['76ers', 'Phillies', 'Flyers', 'Eagles'], answer: '76ers', difficulty: 'hard' },
    { legacyId: 'gen8', category: 'General', question: "What is the name of the Flyers' female mascot?", options: ['Gritty Jr.', 'No female mascot', "Gritty's Mom", 'Gritty is genderless'], answer: 'Gritty is genderless', difficulty: 'hard' },
    { legacyId: 'gen9', category: 'General', question: 'Which Philadelphia venue closed in 2009?', options: ['The Spectrum', 'Veterans Stadium', 'First Union Center', 'JFK Stadium'], answer: 'The Spectrum', difficulty: 'medium' },
    { legacyId: 'gen10', category: 'General', question: 'What Philadelphia team plays at Subaru Park?', options: ['Philadelphia Union', 'Philadelphia Wings', 'Philadelphia Soul', 'Philadelphia Fury'], answer: 'Philadelphia Union', difficulty: 'easy' },
    { legacyId: 'gen11', category: 'General', question: "What is WIP Sports Radio's frequency?", options: ['94.1 FM', '97.5 FM', '610 AM', '1210 AM'], answer: '94.1 FM', difficulty: 'medium' },
    { legacyId: 'gen12', category: 'General', question: 'Which animal did Philadelphia fans once throw batteries at?', options: ['Santa Claus', 'J.D. Drew', 'Cowboys Fan', 'All of the above'], answer: 'J.D. Drew', difficulty: 'medium' },
    { legacyId: 'gen13', category: 'General', question: 'What year did Gritty become the Flyers mascot?', options: ['2016', '2017', '2018', '2019'], answer: '2018', difficulty: 'easy' },
    { legacyId: 'gen14', category: 'General', question: 'Which Philadelphia stadium had a courtroom and jail in the basement?', options: ['Veterans Stadium', 'Lincoln Financial Field', 'The Spectrum', 'JFK Stadium'], answer: 'Veterans Stadium', difficulty: 'easy' },
    { legacyId: 'gen15', category: 'General', question: "What is the Philadelphia Union's home city?", options: ['Philadelphia', 'Chester', 'Camden', 'Wilmington'], answer: 'Chester', difficulty: 'medium' },
    { legacyId: 'gen16', category: 'General', question: 'Which broadcaster is known for calling "High Hopes" after Phillies wins?', options: ['Harry Kalas', 'Merrill Reese', 'Tom McCarthy', 'Scott Franzke'], answer: 'Harry Kalas', difficulty: 'easy' },
    { legacyId: 'gen17', category: 'General', question: 'What year did Philadelphia Eagles fans boo Santa Claus?', options: ['1965', '1968', '1971', '1974'], answer: '1968', difficulty: 'medium' },
    { legacyId: 'gen18', category: 'General', question: 'Which Philadelphia team\'s fans are known for "E-A-G-L-E-S" chant?', options: ['Eagles', 'All Philly teams', 'Phillies', '76ers'], answer: 'Eagles', difficulty: 'easy' },
    { legacyId: 'gen19', category: 'General', question: "What is the name of the Phillies' hall of fame?", options: ['Phillies Wall of Fame', 'Citizens Bank Hall', 'Philly Legends', 'Veterans Memorial'], answer: 'Phillies Wall of Fame', difficulty: 'medium' },
    { legacyId: 'gen20', category: 'General', question: 'How many major professional sports teams does Philadelphia have?', options: ['4', '5', '6', '7'], answer: '5', difficulty: 'medium' }
];

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = await authenticate(req);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const questionsCollection = await getCollection('trivia_questions');

        // Check if migration already ran
        const existingCount = await questionsCollection.countDocuments({ legacyId: { $exists: true } });
        if (existingCount > 0) {
            return res.status(400).json({
                error: 'Migration already completed',
                existingCount,
                message: 'Legacy questions already exist in database. Delete them first if you want to re-run migration.'
            });
        }

        // Prepare questions for insertion
        const now = new Date();
        const questionsToInsert = LEGACY_QUESTIONS.map(q => ({
            ...q,
            tags: [],
            status: 'active',
            usedCount: 0,
            correctCount: 0,
            incorrectCount: 0,
            lastUsedAt: null,
            createdBy: user._id,
            createdAt: now,
            updatedAt: now,
            migratedAt: now
        }));

        // Insert all questions
        const result = await questionsCollection.insertMany(questionsToInsert);

        // Count by category
        const categoryCounts = {};
        LEGACY_QUESTIONS.forEach(q => {
            categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;
        });

        return res.status(200).json({
            success: true,
            message: 'Migration completed successfully',
            inserted: result.insertedCount,
            categoryCounts
        });
    } catch (error) {
        console.error('Migration error:', error);
        return res.status(500).json({ error: 'Migration failed', details: error.message });
    }
}
