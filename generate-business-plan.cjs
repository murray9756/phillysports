const ExcelJS = require('exceljs');

async function generateBusinessPlan() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PhillySports.com';
    workbook.created = new Date();

    // Color scheme
    const colors = {
        dark: '1a1a1a',
        gold: 'ffd700',
        green: '004C54',
        red: '8b0000',
        lightGray: 'f5f5f5',
        white: 'ffffff'
    };

    // Helper function for header styling
    const styleHeader = (row, cols) => {
        row.height = 25;
        row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } };
        row.alignment = { vertical: 'middle', horizontal: 'center' };
        for (let i = 1; i <= cols; i++) {
            row.getCell(i).border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        }
    };

    const styleCurrency = (cell) => {
        cell.numFmt = '$#,##0';
    };

    const stylePercent = (cell) => {
        cell.numFmt = '0.0%';
    };

    // ==========================================
    // TAB 1: SUMMARY
    // ==========================================
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
        { width: 30 },
        { width: 25 },
        { width: 25 },
        { width: 25 }
    ];

    // Title
    summarySheet.mergeCells('A1:D1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'PHILLYSPORTS.COM - BUSINESS PLAN SUMMARY';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFD700' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 35;

    // Company Overview
    summarySheet.getCell('A3').value = 'COMPANY OVERVIEW';
    summarySheet.getCell('A3').font = { bold: true, size: 12 };

    const overviewData = [
        ['Company', 'PhillySports.com'],
        ['Stage', 'Pre-Seed'],
        ['Founded', '2024'],
        ['Location', 'Philadelphia, PA'],
        ['Founder', 'Solo Founder'],
        ['Industry', 'Sports Media / Community'],
        ['Target Market', 'Philadelphia Sports Fans'],
        ['Market Size', '6.2M Metro Population']
    ];

    let row = 4;
    overviewData.forEach(([label, value]) => {
        summarySheet.getCell(`A${row}`).value = label;
        summarySheet.getCell(`A${row}`).font = { bold: true };
        summarySheet.getCell(`B${row}`).value = value;
        row++;
    });

    // Key Metrics
    row += 1;
    summarySheet.getCell(`A${row}`).value = 'KEY METRICS';
    summarySheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;

    const metricsData = [
        ['Lines of Code', '158,744'],
        ['API Endpoints', '239'],
        ['HTML Pages', '69'],
        ['Mobile App Lines', '64,708'],
        ['Pro Teams Covered', '4 (Eagles, Phillies, Sixers, Flyers)'],
        ['College Teams', '6+ Pennsylvania schools']
    ];

    metricsData.forEach(([label, value]) => {
        summarySheet.getCell(`A${row}`).value = label;
        summarySheet.getCell(`A${row}`).font = { bold: true };
        summarySheet.getCell(`B${row}`).value = value;
        row++;
    });

    // Funding Request
    row += 1;
    summarySheet.getCell(`A${row}`).value = 'FUNDING REQUEST';
    summarySheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;

    summarySheet.getCell(`A${row}`).value = 'Amount Sought';
    summarySheet.getCell(`A${row}`).font = { bold: true };
    summarySheet.getCell(`B${row}`).value = '$250,000 - $500,000';
    row++;
    summarySheet.getCell(`A${row}`).value = 'Use of Funds';
    summarySheet.getCell(`A${row}`).font = { bold: true };
    summarySheet.getCell(`B${row}`).value = 'Product, Marketing, Operations';

    // ==========================================
    // TAB 2: REVENUE MODEL
    // ==========================================
    const revenueSheet = workbook.addWorksheet('Revenue Model');
    revenueSheet.columns = [
        { width: 25 },
        { width: 20 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 35 }
    ];

    // Title
    revenueSheet.mergeCells('A1:F1');
    const revTitle = revenueSheet.getCell('A1');
    revTitle.value = 'REVENUE MODEL - 5 STREAMS';
    revTitle.font = { bold: true, size: 14, color: { argb: 'FFFFD700' } };
    revTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } };
    revTitle.alignment = { horizontal: 'center' };
    revenueSheet.getRow(1).height = 30;

    // Headers
    const revHeaders = ['Revenue Stream', 'Type', 'Year 1', 'Year 2', 'Year 3', 'Assumptions'];
    const revHeaderRow = revenueSheet.getRow(3);
    revHeaders.forEach((h, i) => revHeaderRow.getCell(i + 1).value = h);
    styleHeader(revHeaderRow, 6);

    // Revenue data
    const revenueData = [
        ['Premium Memberships', 'Subscription', 15000, 75000, 200000, 'Diehard+ $4.99/mo, Pro $9.99/mo, 2-5% conversion'],
        ['Affiliate Revenue', 'Commission', 10000, 50000, 150000, 'Sportsbooks $50-200 CPA, Merch 5-10%'],
        ['Display Advertising', 'CPM/RPM', 5000, 30000, 100000, 'AdSense $2-5 RPM, Mediavine $15-25 at scale'],
        ['Virtual Currency', 'Microtransaction', 3000, 20000, 75000, 'DD packs $0.99-$9.99, 1-3% purchase rate'],
        ['Marketplace Fees', 'Transaction', 2000, 15000, 50000, '10% fee on user listings']
    ];

    row = 4;
    revenueData.forEach(data => {
        const r = revenueSheet.getRow(row);
        data.forEach((val, i) => {
            r.getCell(i + 1).value = val;
            if (i >= 2 && i <= 4) styleCurrency(r.getCell(i + 1));
        });
        row++;
    });

    // Totals
    row++;
    const totalRow = revenueSheet.getRow(row);
    totalRow.getCell(1).value = 'TOTAL REVENUE';
    totalRow.getCell(1).font = { bold: true };
    totalRow.getCell(3).value = { formula: 'SUM(C4:C8)' };
    totalRow.getCell(4).value = { formula: 'SUM(D4:D8)' };
    totalRow.getCell(5).value = { formula: 'SUM(E4:E8)' };
    styleCurrency(totalRow.getCell(3));
    styleCurrency(totalRow.getCell(4));
    styleCurrency(totalRow.getCell(5));
    totalRow.font = { bold: true };

    // ==========================================
    // TAB 3: USER GROWTH
    // ==========================================
    const growthSheet = workbook.addWorksheet('User Growth');
    growthSheet.columns = [
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 15 }
    ];

    // Title
    growthSheet.mergeCells('A1:F1');
    const growthTitle = growthSheet.getCell('A1');
    growthTitle.value = 'USER GROWTH PROJECTIONS (36 MONTHS)';
    growthTitle.font = { bold: true, size: 14, color: { argb: 'FFFFD700' } };
    growthTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } };
    growthTitle.alignment = { horizontal: 'center' };
    growthSheet.getRow(1).height = 30;

    // Headers
    const growthHeaders = ['Month', 'New Users', 'Churned', 'Total Users', 'MAU', 'Premium'];
    const growthHeaderRow = growthSheet.getRow(3);
    growthHeaders.forEach((h, i) => growthHeaderRow.getCell(i + 1).value = h);
    styleHeader(growthHeaderRow, 6);

    // Generate 36 months of data
    let totalUsers = 0;
    let premiumUsers = 0;
    const churnRate = 0.05;
    const premiumConversion = 0.03;

    for (let month = 1; month <= 36; month++) {
        const r = growthSheet.getRow(3 + month);

        // Growth model: starts slow, accelerates
        let newUsers;
        if (month <= 6) newUsers = 200 + (month * 50);
        else if (month <= 12) newUsers = 500 + (month * 100);
        else if (month <= 24) newUsers = 1000 + (month * 150);
        else newUsers = 2000 + (month * 200);

        const churned = Math.floor(totalUsers * churnRate);
        totalUsers = totalUsers + newUsers - churned;
        const mau = Math.floor(totalUsers * 0.4); // 40% monthly active
        premiumUsers = Math.floor(totalUsers * premiumConversion);

        r.getCell(1).value = month;
        r.getCell(2).value = newUsers;
        r.getCell(3).value = churned;
        r.getCell(4).value = totalUsers;
        r.getCell(5).value = mau;
        r.getCell(6).value = premiumUsers;
    }

    // ==========================================
    // TAB 4: P&L (Profit & Loss)
    // ==========================================
    const plSheet = workbook.addWorksheet('P&L');
    plSheet.columns = [
        { width: 30 },
        { width: 18 },
        { width: 18 },
        { width: 18 }
    ];

    // Title
    plSheet.mergeCells('A1:D1');
    const plTitle = plSheet.getCell('A1');
    plTitle.value = 'PROJECTED INCOME STATEMENT';
    plTitle.font = { bold: true, size: 14, color: { argb: 'FFFFD700' } };
    plTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } };
    plTitle.alignment = { horizontal: 'center' };
    plSheet.getRow(1).height = 30;

    // Headers
    const plHeaders = ['', 'Year 1', 'Year 2', 'Year 3'];
    const plHeaderRow = plSheet.getRow(3);
    plHeaders.forEach((h, i) => plHeaderRow.getCell(i + 1).value = h);
    styleHeader(plHeaderRow, 4);

    const plData = [
        ['REVENUE', '', '', ''],
        ['Premium Memberships', 15000, 75000, 200000],
        ['Affiliate Revenue', 10000, 50000, 150000],
        ['Advertising', 5000, 30000, 100000],
        ['Virtual Currency', 3000, 20000, 75000],
        ['Marketplace Fees', 2000, 15000, 50000],
        ['Total Revenue', 35000, 190000, 575000],
        ['', '', '', ''],
        ['EXPENSES', '', '', ''],
        ['Product Development', 100000, 120000, 150000],
        ['Marketing & UA', 50000, 80000, 120000],
        ['Infrastructure (Hosting)', 12000, 24000, 48000],
        ['Operations', 20000, 30000, 50000],
        ['Legal & Admin', 15000, 20000, 25000],
        ['Total Expenses', 197000, 274000, 393000],
        ['', '', '', ''],
        ['NET INCOME', -162000, -84000, 182000],
        ['', '', '', ''],
        ['Cumulative P&L', -162000, -246000, -64000]
    ];

    row = 4;
    plData.forEach(data => {
        const r = plSheet.getRow(row);
        r.getCell(1).value = data[0];

        if (data[0] === 'REVENUE' || data[0] === 'EXPENSES') {
            r.getCell(1).font = { bold: true, size: 11 };
        } else if (data[0] === 'Total Revenue' || data[0] === 'Total Expenses' || data[0] === 'NET INCOME') {
            r.font = { bold: true };
            r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        }

        for (let i = 2; i <= 4; i++) {
            if (data[i - 1] !== '') {
                r.getCell(i).value = data[i - 1];
                if (typeof data[i - 1] === 'number') styleCurrency(r.getCell(i));
            }
        }
        row++;
    });

    // ==========================================
    // TAB 5: EXPENSES
    // ==========================================
    const expSheet = workbook.addWorksheet('Expenses');
    expSheet.columns = [
        { width: 30 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 35 }
    ];

    // Title
    expSheet.mergeCells('A1:E1');
    const expTitle = expSheet.getCell('A1');
    expTitle.value = 'OPERATING EXPENSES BREAKDOWN';
    expTitle.font = { bold: true, size: 14, color: { argb: 'FFFFD700' } };
    expTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } };
    expTitle.alignment = { horizontal: 'center' };
    expSheet.getRow(1).height = 30;

    // Headers
    const expHeaders = ['Expense Category', 'Year 1', 'Year 2', 'Year 3', 'Notes'];
    const expHeaderRow = expSheet.getRow(3);
    expHeaders.forEach((h, i) => expHeaderRow.getCell(i + 1).value = h);
    styleHeader(expHeaderRow, 5);

    const expData = [
        ['PRODUCT DEVELOPMENT', '', '', '', ''],
        ['Contractor Development', 60000, 72000, 90000, 'Part-time contractors, scale as needed'],
        ['Design & UX', 15000, 18000, 20000, 'UI improvements, mobile updates'],
        ['Tools & Software', 10000, 12000, 15000, 'Dev tools, APIs, testing'],
        ['QA & Testing', 15000, 18000, 25000, 'Bug fixes, user testing'],
        ['', '', '', '', ''],
        ['MARKETING', '', '', '', ''],
        ['Social Media Ads', 20000, 35000, 50000, 'Facebook, Instagram, Twitter'],
        ['Content Marketing', 10000, 15000, 25000, 'SEO, blog, video content'],
        ['Local Partnerships', 10000, 15000, 25000, 'Radio, events, influencers'],
        ['Referral Program', 10000, 15000, 20000, 'User acquisition bonuses'],
        ['', '', '', '', ''],
        ['INFRASTRUCTURE', '', '', '', ''],
        ['Vercel Hosting', 3000, 6000, 12000, 'Scales with traffic'],
        ['MongoDB Atlas', 3000, 6000, 12000, 'Database hosting'],
        ['Pusher (Real-time)', 2400, 4800, 9600, 'Live features'],
        ['Third-party APIs', 3600, 7200, 14400, 'Sports data, payments'],
        ['', '', '', '', ''],
        ['OPERATIONS', '', '', '', ''],
        ['Admin/Moderation', 15000, 20000, 35000, 'Community management'],
        ['Customer Support', 5000, 10000, 15000, 'User inquiries'],
        ['', '', '', '', ''],
        ['LEGAL & ADMIN', '', '', '', ''],
        ['Legal/Compliance', 10000, 12000, 15000, 'Terms, privacy, contracts'],
        ['Accounting', 3000, 5000, 7000, 'Bookkeeping, taxes'],
        ['Insurance', 2000, 3000, 3000, 'Liability coverage']
    ];

    row = 4;
    expData.forEach(data => {
        const r = expSheet.getRow(row);
        r.getCell(1).value = data[0];

        if (data[0].toUpperCase() === data[0] && data[0] !== '') {
            r.getCell(1).font = { bold: true, size: 11 };
        }

        for (let i = 2; i <= 4; i++) {
            if (data[i - 1] !== '') {
                r.getCell(i).value = data[i - 1];
                if (typeof data[i - 1] === 'number') styleCurrency(r.getCell(i));
            }
        }
        r.getCell(5).value = data[4];
        row++;
    });

    // ==========================================
    // TAB 6: UNIT ECONOMICS
    // ==========================================
    const unitSheet = workbook.addWorksheet('Unit Economics');
    unitSheet.columns = [
        { width: 30 },
        { width: 18 },
        { width: 18 },
        { width: 18 },
        { width: 35 }
    ];

    // Title
    unitSheet.mergeCells('A1:E1');
    const unitTitle = unitSheet.getCell('A1');
    unitTitle.value = 'UNIT ECONOMICS';
    unitTitle.font = { bold: true, size: 14, color: { argb: 'FFFFD700' } };
    unitTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } };
    unitTitle.alignment = { horizontal: 'center' };
    unitSheet.getRow(1).height = 30;

    // Headers
    const unitHeaders = ['Metric', 'Year 1', 'Year 2', 'Year 3', 'Notes'];
    const unitHeaderRow = unitSheet.getRow(3);
    unitHeaders.forEach((h, i) => unitHeaderRow.getCell(i + 1).value = h);
    styleHeader(unitHeaderRow, 5);

    const unitData = [
        ['ACQUISITION', '', '', '', ''],
        ['Customer Acquisition Cost (CAC)', 3.50, 2.80, 2.20, 'Organic-heavy strategy'],
        ['Paid CAC', 8.00, 6.00, 4.50, 'Paid channels only'],
        ['Organic CAC', 1.50, 1.20, 1.00, 'SEO, referrals, viral'],
        ['', '', '', '', ''],
        ['RETENTION', '', '', '', ''],
        ['Monthly Churn Rate', '8%', '6%', '5%', 'Improves with engagement'],
        ['Annual Retention', '38%', '48%', '54%', '1 - (monthly churn)^12'],
        ['', '', '', '', ''],
        ['MONETIZATION', '', '', '', ''],
        ['ARPU (Monthly)', 0.50, 1.20, 2.00, 'Avg revenue per user'],
        ['Premium Conversion Rate', '2%', '3%', '4%', 'Free to paid'],
        ['Premium ARPU', 6.00, 7.00, 7.50, 'Avg revenue, premium users'],
        ['', '', '', '', ''],
        ['LIFETIME VALUE', '', '', '', ''],
        ['LTV (All Users)', 6.00, 18.00, 36.00, 'ARPU × months retained'],
        ['LTV (Premium)', 72.00, 112.00, 135.00, 'Higher retention'],
        ['LTV:CAC Ratio', 1.7, 6.4, 16.4, 'Target: >3.0'],
        ['', '', '', '', ''],
        ['BREAK-EVEN', '', '', '', ''],
        ['Users to Break Even', 56000, 23000, 8500, 'Based on projections'],
        ['Months to Payback', 7, 2.3, 1.1, 'CAC / monthly ARPU']
    ];

    row = 4;
    unitData.forEach(data => {
        const r = unitSheet.getRow(row);
        r.getCell(1).value = data[0];

        if (data[0].toUpperCase() === data[0] && data[0] !== '') {
            r.getCell(1).font = { bold: true, size: 11 };
        }

        for (let i = 2; i <= 4; i++) {
            if (data[i - 1] !== '') {
                r.getCell(i).value = data[i - 1];
            }
        }
        r.getCell(5).value = data[4];
        row++;
    });

    // ==========================================
    // TAB 7: FUNDING USE
    // ==========================================
    const fundSheet = workbook.addWorksheet('Funding Use');
    fundSheet.columns = [
        { width: 30 },
        { width: 15 },
        { width: 18 },
        { width: 18 },
        { width: 35 }
    ];

    // Title
    fundSheet.mergeCells('A1:E1');
    const fundTitle = fundSheet.getCell('A1');
    fundTitle.value = 'USE OF FUNDS ($250K - $500K)';
    fundTitle.font = { bold: true, size: 14, color: { argb: 'FFFFD700' } };
    fundTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } };
    fundTitle.alignment = { horizontal: 'center' };
    fundSheet.getRow(1).height = 30;

    // Headers
    const fundHeaders = ['Category', '%', 'At $250K', 'At $500K', 'Details'];
    const fundHeaderRow = fundSheet.getRow(3);
    fundHeaders.forEach((h, i) => fundHeaderRow.getCell(i + 1).value = h);
    styleHeader(fundHeaderRow, 5);

    const fundData = [
        ['Product Development', '40%', 100000, 200000, 'Mobile app polish, new features, contractor devs'],
        ['Marketing & User Acquisition', '30%', 75000, 150000, 'Social ads, local partnerships, content'],
        ['Operations & Infrastructure', '15%', 37500, 75000, 'Hosting, APIs, moderation, support'],
        ['Legal & Admin', '10%', 25000, 50000, 'Legal setup, compliance, accounting'],
        ['Reserve', '5%', 12500, 25000, 'Emergency fund, opportunities']
    ];

    row = 4;
    fundData.forEach(data => {
        const r = fundSheet.getRow(row);
        data.forEach((val, i) => {
            r.getCell(i + 1).value = val;
            if (i >= 2 && i <= 3) styleCurrency(r.getCell(i + 1));
        });
        row++;
    });

    // Totals
    row++;
    const fundTotalRow = fundSheet.getRow(row);
    fundTotalRow.getCell(1).value = 'TOTAL';
    fundTotalRow.getCell(2).value = '100%';
    fundTotalRow.getCell(3).value = 250000;
    fundTotalRow.getCell(4).value = 500000;
    fundTotalRow.font = { bold: true };
    styleCurrency(fundTotalRow.getCell(3));
    styleCurrency(fundTotalRow.getCell(4));

    // Runway
    row += 2;
    fundSheet.getCell(`A${row}`).value = 'RUNWAY ESTIMATES';
    fundSheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;

    fundSheet.getCell(`A${row}`).value = 'At $250K (conservative burn)';
    fundSheet.getCell(`B${row}`).value = '12-15 months';
    row++;
    fundSheet.getCell(`A${row}`).value = 'At $500K (conservative burn)';
    fundSheet.getCell(`B${row}`).value = '18-24 months';
    row++;
    fundSheet.getCell(`A${row}`).value = 'Monthly burn rate (avg)';
    fundSheet.getCell(`B${row}`).value = '$15K-$25K';

    // ==========================================
    // TAB 8: MILESTONES
    // ==========================================
    const mileSheet = workbook.addWorksheet('Milestones');
    mileSheet.columns = [
        { width: 15 },
        { width: 35 },
        { width: 20 },
        { width: 35 }
    ];

    // Title
    mileSheet.mergeCells('A1:D1');
    const mileTitle = mileSheet.getCell('A1');
    mileTitle.value = 'KEY MILESTONES';
    mileTitle.font = { bold: true, size: 14, color: { argb: 'FFFFD700' } };
    mileTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a1a' } };
    mileTitle.alignment = { horizontal: 'center' };
    mileSheet.getRow(1).height = 30;

    // Headers
    const mileHeaders = ['Timeline', 'Milestone', 'Target Metric', 'Dependencies'];
    const mileHeaderRow = mileSheet.getRow(3);
    mileHeaders.forEach((h, i) => mileHeaderRow.getCell(i + 1).value = h);
    styleHeader(mileHeaderRow, 4);

    const mileData = [
        ['Month 1-2', 'Close pre-seed funding', '$250K-$500K raised', 'Investor meetings'],
        ['Month 2-3', 'iOS app launch', 'App Store live', 'Apple Developer approval'],
        ['Month 3-4', 'Marketing campaign launch', '5,000 signups', 'Funding'],
        ['Month 4-6', 'Content partnerships', '3+ local media deals', 'Outreach'],
        ['Month 6', 'First revenue milestone', '$5K MRR', 'User base'],
        ['Month 9', 'Community growth', '25,000 users', 'Marketing'],
        ['Month 12', 'Seed-ready metrics', '50K users, $15K MRR', 'Execution'],
        ['Month 12-15', 'Seed fundraise', '$1M-$2M target', 'Traction proof'],
        ['Month 18', 'Regional expansion planning', 'New city research', 'Philly proven'],
        ['Month 24', 'Profitability path', 'Break-even or close', 'Revenue growth'],
        ['Month 36', 'Series A ready', '500K users, $50K MRR', 'Full execution']
    ];

    row = 4;
    mileData.forEach(data => {
        const r = mileSheet.getRow(row);
        data.forEach((val, i) => r.getCell(i + 1).value = val);
        row++;
    });

    // Completed milestones
    row += 2;
    mileSheet.getCell(`A${row}`).value = 'COMPLETED';
    mileSheet.getCell(`A${row}`).font = { bold: true, size: 12, color: { argb: 'FF004C54' } };
    row++;

    const completedData = [
        ['Done', 'Platform built', '158K lines of code', 'Solo founder'],
        ['Done', 'Mobile app developed', '64K lines TypeScript', 'React Native + Expo'],
        ['Done', 'All core features', '239 API endpoints', 'Full stack'],
        ['Done', 'Real-time infrastructure', 'Pusher integration', 'Live features'],
        ['Done', 'Payment systems', 'Stripe + PayPal', 'Commerce ready']
    ];

    completedData.forEach(data => {
        const r = mileSheet.getRow(row);
        data.forEach((val, i) => r.getCell(i + 1).value = val);
        r.getCell(1).font = { color: { argb: 'FF004C54' } };
        row++;
    });

    // Save workbook
    await workbook.xlsx.writeFile('BUSINESS_PLAN.xlsx');
    console.log('Created: BUSINESS_PLAN.xlsx');
}

generateBusinessPlan().catch(console.error);
