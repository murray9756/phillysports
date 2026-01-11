import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

import { addCoins, getDailyEarnings } from '../lib/coins.js';

const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const COINS_PER_CORRECT = 10;
const DAILY_TRIVIA_LIMIT = 20; // Max correct answers per day

// Philly sports trivia questions
const TRIVIA_QUESTIONS = [
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
    { _id: 'f20', team: 'Flyers', question: 'What year did the Flyers lose to the Blackhawks in the Stanley Cup Finals?', options: ['2008', '2010', '2012', '2014'], answer: '2010', difficulty: 'medium' }
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
            let coinsEarned = 0;

            // Record the answer
            await answersCollection.insertOne({
                userId: new ObjectId(decoded.userId),
                questionId: questionId,
                selectedAnswer,
                correct: isCorrect,
                answeredAt: new Date()
            });

            // Award coins if correct and under daily limit
            if (isCorrect && dailyCorrect < DAILY_TRIVIA_LIMIT) {
                await addCoins(
                    decoded.userId,
                    COINS_PER_CORRECT,
                    'trivia',
                    `Correct trivia answer: ${question.team}`,
                    { questionId, team: question.team }
                );
                coinsEarned = COINS_PER_CORRECT;
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
                coinsEarned,
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
