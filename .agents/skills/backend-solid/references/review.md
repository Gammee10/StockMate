# Review

Do this before you say the work is done. The checker finds known patterns. This list finds what the checker cannot.

## 1. Read the checker output

- Fix every **FAIL**. A FAIL is a bug or a real risk.
- Fix every **WARN** unless you have a clear reason. If you keep one, say why in the report.
- To silence a rule on purpose, put `// backend-check-ignore <rule-id>: <reason>` on the line, the line above, or above the function. The reason must say **why it is safe**, not just that the check is wrong. Good: `public product catalog, same data for every user`. Bad: `false positive`.
- Every ignore goes into your report. An ignore is a decision the user should see.
- Do not edit the checker. Do not delete tests. Do not remove an owner filter to make something pass.

## 2. Check every entry point

For each new or changed route handler and server action, answer yes to all of these:

- [ ] It is built with a helper (`userRoute`, `adminAction`, ...), or it is public on purpose and says so.
- [ ] Its input has a zod schema with maximum lengths and ranges.
- [ ] Every query on user data has the owner in the same `where` as the id.
- [ ] Another user's id gives 404, and nothing changes.
- [ ] Any id **inside the body** that points to another record (`projectId`, `customerId`) is checked to belong to the same owner. This is the most common hole that remains after everything above is right.
- [ ] Two or more writes are in one transaction.
- [ ] A repeat of the request (a double click, a retry, a second webhook) cannot create a duplicate or run the action twice.
- [ ] It returns a DTO, not a row. No `userId`, hash, token or internal field leaks.
- [ ] Errors do not reveal SQL, file paths, stack traces or whether an account exists.
- [ ] Anything that sends an email, writes for visitors or is expensive has a rate limit.
- [ ] The page or list that shows the data is refreshed after a write.
- [ ] There are tests for: signed out, wrong owner, bad input, duplicate, repeat.

## 3. Try it for real

Tests prove the code. A running server proves the wiring. Start the app (`npm run dev`) and use **two users**, A and B. Sign each one in through the app's sign-in and keep their session cookies, for example with `curl -c a.txt ...` and `curl -c b.txt ...`. Use the real calls of your auth library, or copy the cookie from the browser.

```bash
URL=http://localhost:3000/api/invoices
JSON='content-type: application/json'

curl -i $URL                                                   # signed out: expect 401
ID=$(curl -s -b a.txt -H "$JSON" -d '{"number":"T-1","customerName":"Test","amountCents":1000,"dueDate":"2030-01-01"}' $URL | jq -r .data.id)
curl -i -b b.txt $URL/$ID                                      # B reads A's record: expect 404
curl -i -b b.txt -X PATCH -H "$JSON" -d '{"customerName":"Hacked"}' $URL/$ID   # expect 404
curl -i -b b.txt -X DELETE $URL/$ID                            # expect 404
curl -s -b a.txt $URL/$ID                                      # A's record is unchanged
curl -i -b a.txt -H "$JSON" -d '{}' $URL                       # empty body: expect 400 with error.fields
curl -i -b a.txt $URL?limit=100000                             # expect 400
curl -i -b a.txt -H "$JSON" -d '{"number":"T-2","customerName":"x","amountCents":1000,"dueDate":"2030-01-01","userId":"<B id>"}' $URL
                                                               # expect 201, and the record belongs to A
```

Run the same create twice **at the same time**. One must win and the rest must get 409:

```js
// node race.mjs   (Node 18 or newer)
const send = () =>
  fetch("http://localhost:3000/api/invoices", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: process.env.COOKIE },
    body: JSON.stringify({ number: "RACE-1", customerName: "Race", amountCents: 1000, dueDate: "2030-01-01" }),
  })
const results = await Promise.all(Array.from({ length: 5 }, send))
console.log(results.map((r) => r.status)) // expect one 201 and four 409
```

For a webhook: a wrong signature gives 401, a correct one gives 200, and **the same event again gives 200 and changes nothing**.

## 4. What the checker cannot see

Look for these by reading the code:

- **Totals and prices computed on the client.** The server must compute amounts from its own data. A client can send any number.
- **State changes.** Check that each status change is allowed from the current status (draft, then sent, then paid). Do not accept any status from the client.
- **Ids in the body.** A `customerId` or `projectId` that the client sends must be loaded with the owner filter before it is used.
- **Open redirects.** A `?next=` or `redirectTo` parameter must be a relative path on your site.
- **Server-side requests to a URL the user gives** (webhook URLs, "import from URL", image fetch). Allow only known hosts and block private addresses (SSRF).
- **Account existence.** Login, sign-up and password reset should answer the same way for known and unknown emails.
- **Delete behavior.** `onDelete: cascade` can remove more than you expect. Soft deletes break unique constraints unless the constraint covers the deleted flag.
- **Big inputs.** Arrays and nested objects need maximum sizes. Offsets and page sizes need maximums.
- **Time zones.** Store instants as `timestamp with time zone`. Treat a due date as a calendar day, not as a moment.
- **Logs.** No personal data, tokens or full bodies.
- **CORS.** None by default. Allow a named origin only when another site must call the API.
- **New packages.** Add one only when you need it, and say why.

## 5. Report

Write a few lines for the user:

- What you changed, and the new endpoints with who can call each one.
- Which checks you ran and their result (typecheck, tests, checker).
- Every `backend-check-ignore`, with its reason.
- What you could not test (for example a real webhook from the provider, or a live payment).
- Anything the user must do: run a migration, set an environment variable, rotate a key.
