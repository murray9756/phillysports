# TestFlight Setup Guide

This guide walks you through deploying PhillySports to TestFlight for iOS beta testing.

## Prerequisites

1. **Apple Developer Account** ($99/year) - https://developer.apple.com
2. **Expo Account** (free) - https://expo.dev
3. **EAS CLI** installed globally

## Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

## Step 2: Login to Expo

```bash
eas login
```

## Step 3: Initialize EAS Project

Run this from the `mobile-app` directory:

```bash
eas init
```

This will:
- Create your project on Expo's servers
- Generate a unique project ID
- Update app.json with the project ID

After running, update these placeholders in `app.json`:
- Replace `YOUR_EAS_PROJECT_ID` with the generated project ID

## Step 4: Configure Apple Credentials

EAS can manage your Apple credentials automatically, or you can provide them manually.

### Option A: Automatic (Recommended)
When you run your first build, EAS will prompt you to log in to your Apple Developer account and will handle certificate/provisioning profile creation.

### Option B: Manual
1. Create an App ID in Apple Developer Portal with bundle ID: `com.phillysports.app`
2. Create a Distribution Certificate
3. Create an App Store Provisioning Profile
4. Run `eas credentials` to configure

## Step 5: Create App in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Click "My Apps" → "+" → "New App"
3. Fill in:
   - **Platform**: iOS
   - **Name**: PhillySports
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: com.phillysports.app
   - **SKU**: phillysports-ios-app

4. Note your **App Store Connect App ID** (found in App Information)

5. Update `eas.json` with your credentials:
   ```json
   "submit": {
     "production": {
       "ios": {
         "appleId": "your-apple-id@email.com",
         "ascAppId": "1234567890",
         "appleTeamId": "ABCD1234"
       }
     }
   }
   ```

## Step 6: Build for TestFlight

```bash
cd mobile-app
eas build --platform ios --profile production
```

This will:
- Build your app in the cloud
- Create/use iOS distribution certificates
- Generate an IPA file

Build takes ~15-20 minutes. You'll get a URL to track progress.

## Step 7: Submit to TestFlight

After the build completes:

```bash
eas submit --platform ios --latest
```

Or submit a specific build:

```bash
eas submit --platform ios --id BUILD_ID
```

## Step 8: TestFlight Configuration

1. Go to App Store Connect → Your App → TestFlight
2. The build will appear after Apple processes it (~10-30 minutes)
3. Fill in "What to Test" description
4. Add test information and contact email
5. Answer export compliance questions (select "No" for encryption since we set `usesNonExemptEncryption: false`)

## Step 9: Add Testers

### Internal Testers (up to 100)
- Must be App Store Connect users
- No review required
- Immediate access after build processing

### External Testers (up to 10,000)
- Anyone with email address
- Requires Beta App Review (~24-48 hours first time)
- Can create tester groups

To add testers:
1. TestFlight → Internal Testing or External Testing
2. Create a group or add to existing
3. Add testers by email
4. They'll receive TestFlight invitation

## Useful Commands

```bash
# Check build status
eas build:list

# View build details
eas build:view BUILD_ID

# Cancel a build
eas build:cancel BUILD_ID

# Update app without new build (OTA)
eas update --branch production --message "Bug fixes"

# Check credentials
eas credentials

# Build and submit in one command
eas build --platform ios --profile production --auto-submit
```

## Troubleshooting

### Build Fails: Missing Credentials
```bash
eas credentials --platform ios
```
Then select "Build credentials" and follow prompts.

### Build Fails: Bundle ID Conflict
Ensure no other app uses `com.phillysports.app` in your Apple Developer account.

### Submit Fails: App Not Found
Verify your `ascAppId` in eas.json matches App Store Connect.

### TestFlight Build Stuck Processing
Apple processing can take 10-30 minutes. Check App Store Connect status page.

## Push Notifications Setup

For push notifications to work in TestFlight:

1. Create APNs Key in Apple Developer Portal:
   - Certificates, Identifiers & Profiles → Keys
   - Create new key with "Apple Push Notifications service (APNs)"
   - Download the .p8 file

2. Configure in your backend or Expo:
   ```bash
   eas credentials --platform ios
   # Select "Push Notifications" and upload your APNs key
   ```

## Universal Links Setup

For deep links to work:

1. Host `apple-app-site-association` file at:
   - `https://phillysports.com/.well-known/apple-app-site-association`

2. File contents:
   ```json
   {
     "applinks": {
       "apps": [],
       "details": [
         {
           "appID": "TEAM_ID.com.phillysports.app",
           "paths": ["*"]
         }
       ]
     }
   }
   ```

3. Replace `TEAM_ID` with your Apple Team ID

## Version Updates

For new TestFlight builds:

1. Update version in `app.json`:
   ```json
   "version": "1.0.1"
   ```

2. Build number auto-increments with `autoIncrement: true` in eas.json

3. Build and submit:
   ```bash
   eas build --platform ios --profile production --auto-submit
   ```

## Going to Production

When ready for App Store release:

1. Prepare App Store listing:
   - Screenshots (6.7", 6.5", 5.5" iPhones + iPad if supporting)
   - App description, keywords, support URL
   - Privacy policy URL
   - Age rating questionnaire

2. Submit for review from App Store Connect

3. Typical review time: 24-48 hours
