# Reporting bugs

If the test case contains "bug" then its /data folder will default to the bugs test case folder. (Will create if doesnt exist)

To lock env file in bugs use

```tsx
dotenv.config({
  path: path.resolve(process.cwd(), `tests/${testName}/.data/.env`),
});
```
