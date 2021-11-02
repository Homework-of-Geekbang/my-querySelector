# A simple querySelector
The `querySelector` reimplements a part of Browser's `Element.prototype.querySelector`.

* It can handle most single selectors and theirs combination
* It can't handle the combinators: `> || + ~ [whitespace]`
* Its some behavior maybe not consistent of browser
* Don't use it in production!
