# Get your code onto GitHub (one-time setup)

## Step 1: Log in to GitHub in the terminal

A login was started. **Do this:**

1. Open: **https://github.com/login/device**
2. Enter this code: **D93E-1C6B**
3. Sign in as **reggiebaraza** (the owner of your fork) and approve the device.
4. When the terminal says "Logged in as reggiebaraza", you're done.

If the code expired or you closed the window, run this in the project folder and follow the prompts:

```bash
gh auth login -h github.com -p https -w
```

---

## Step 2: Merge your code onto main

In the **TofuOS** project folder, run:

```bash
./merge-onto-main.sh
```

That script will create a pull request from `update-from-upstream` into `main` on your fork and merge it. After it finishes, your latest code will be on **main** at https://github.com/reggiebaraza/TofuOS.

---

## From now on: pushing code

When you make changes:

1. Commit in Cursor (or run `git add -A && git commit -m "your message"`).
2. Push your fork: **Source Control → Push**, or run:
   ```bash
   git push myfork main
   ```
   If you get "permission denied" on main again, run:
   ```bash
   git push myfork main:update-from-upstream
   ```
   then run `./merge-onto-main.sh` again to merge onto main.
