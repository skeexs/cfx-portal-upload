# CFX Portal Upload Action

[![GitHub Super-Linter](https://github.com/Tynopia/cfx-portal-upload/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/Tynopia/cfx-portal-upload/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/Tynopia/cfx-portal-upload/actions/workflows/check-dist.yml/badge.svg)](https://github.com/Tynopia/cfx-portal-upload/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/Tynopia/cfx-portal-upload/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/Tynopia/cfx-portal-upload/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

In the past, using CFX Keymaster made it impossible to build CI/CD pipelines for
Escrow Resources due to the Cloudflare Bot Challenge.

However, CFX has now created a new platform called **"Portal"**, which is still
secured via Cloudflare but operates in a less restrictive attack mode, enabling
its use within a GitHub Action.

## How to Use It

To use this action, you need to authenticate via the forum using a cookie until
CFX provides API keys for this action.

1. Go to the **CFX Forum** and inspect the site using your browser's developer
   tools.
1. Navigate to the **Cookies** section and search for `_t`.
1. Copy the value of this cookie and save it in GitHub Secrets as
   `FORUM_COOKIE`.
1. Use the action in your workflow (remember to
   [checkout](https://github.com/actions/checkout) before!):

   ```yaml
   - name: Upload Escrow Resource
     uses: Tynopia/cfx-portal-upload
     with:
       cookie: ${{ secrets.FORUM_COOKIE }}
       assetName: 'my_asset'
   ```

> [!IMPORTANT]
>
> When you log out of the forum, the cookie will become invalid, causing the
> action to fail. After configuring the secret, you should clear the cookie from
> your browser and log in again to avoid potential issues.

## Input Parameters

| Key              | Type     | Value                                                              | Description                                                                                                                                                                          |
| ---------------- | -------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| cookie           | string   | The Forum Cookie to authenticate                                   | Go to [forum.cfx.re](https://forum.cfx.re) and inspect the page with your browser's dev tools. Then search for the `_t` cookie.                                                      |
| makeZip          | boolean? | Automatically ZIP the full repository to upload it (default: true) | Creates a ZIP without mutating your workspace. Default excludes: `.git/**`, `.github/**`, `.vscode/**`, `node_modules/**`.                                                           |
| assetName        | string   | The asset name to re-upload                                        | This is the name of the asset you want to re-upload.                                                                                                                                 |
| assetId          | number   | The Asset ID, which is a unique ID in the portal                   | The Asset ID can be found at [portal.cfx.re](https://portal.cfx.re/assets/created-assets). ![image](https://github.com/user-attachments/assets/4176b7e7-cfbb-4e14-a488-04c4301f6082) |
| zipPath          | string?  | The path to your ZIP file that should be uploaded                  | This is the file location of your packed ZIP file inside the Workflow Container, usually stored in `/home/...`.                                                                      |
| skipUpload       | boolean? | Skip the upload and only log in to the portal                      | This will skip the asset upload to the portal and only go through the login process. Useful in cron jobs to prevent the cookie from getting invalidated due to inactivity            |
| maxRetries       | number?  | Maximum retries for retriable operations (default: 3)              | Applies to auth retries/fallback and upload retries.                                                                                                                                 |
| chunkSize        | number?  | How large one chunk is for upload. Default: 2097152 bytes          |                                                                                                                                                                                      |
| authMode         | string?  | `auto` (default), `http`, `browser`                                | `auto` tries HTTP session first and falls back to browser session setup when needed.                                                                                                 |
| requestTimeoutMs | number?  | Timeout per portal HTTP request in ms (default: 30000)             | Increase for slower runners/network.                                                                                                                                                 |
| retryBaseDelayMs | number?  | Base retry delay in ms (default: 500)                              | Exponential backoff starts from this value.                                                                                                                                          |
| retryMaxDelayMs  | number?  | Max retry delay in ms (default: 5000)                              | Caps exponential backoff delay.                                                                                                                                                      |
| zipExclude       | string?  | Comma-separated extra exclude patterns (example: `dist/**,tmp/**`) | Adds to default zip exclude list.                                                                                                                                                    |

> [!NOTE]
>
> `?` after the type indicates that the parameter is optional. if no assetName  
> or assetId is provided, the repository name will be used as assetName.
>
> If both `assetId` and `assetName` are provided, `assetId` takes precedence.

## Skip Upload

If you haven't uploaded an asset in a long time, the cookie will become invalid
due to inactivity. To prevent this, you can use a cron job to log in to the
portal and refresh the cookie.

```yaml
name: Refresh Cookie

on:
  schedule:
    - cron: '0 0 * * *'

jobs:
  refresh_cookie:
    name: Login to Portal
    runs-on: ubuntu-latest
    steps:
      - name: Run CFX Portal Upload
        uses: Tynopia/cfx-portal-upload@main
        with:
          cookie: ${{ secrets.FORUM_COOKIE }}
          skipUpload: true
```

## Local CLI (debug or manual runs)

You can run the same core upload flow locally:

```bash
npm run package:cli
node dist/cli.js upload --cookie "<forum_cookie>" --assetName "my_asset"
```

Example with explicit tuning:

```bash
node dist/cli.js upload \
  --cookie "<forum_cookie>" \
  --assetId "123456" \
  --zipPath "./build/my_asset.zip" \
  --authMode auto \
  --maxRetries 5 \
  --requestTimeoutMs 45000 \
  --retryBaseDelayMs 750 \
  --retryMaxDelayMs 8000
```

## Troubleshooting

1. Authentication fails with 401/403:
   - Refresh `_t` cookie from forum and try `authMode=browser`.
2. Random chunk/upload failures:
   - Increase `maxRetries` and `requestTimeoutMs`.
3. Wrong asset resolved from `assetName`:
   - Use `assetId` directly for deterministic targeting.

## How to Contribute

If you want to contribute to this project, you can fork the repository and
create a pull request:

1. Fork the repository.
1. Clone your forked repository.
1. Create a new branch.
1. Make your changes.
1. Push the changes to your fork.
1. Create a pull request.

Contributing helps the CFX community and improves the experience for everyone.

> [!NOTE]
>
> Currently, the project does not have complete unit test coverage. If you want
> to contribute, adding unit tests would be a great starting point.
