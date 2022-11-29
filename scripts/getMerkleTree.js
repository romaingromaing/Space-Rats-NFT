const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const fs = require("fs");
const { parse } = require("csv-parse");

const whitelist = [];

fs.createReadStream("./whitelist/whitelist.csv")
  .pipe(parse({ delimiter: ",", from_line: 2 }))
  .on("data", function (row) {
    whitelist.push(row)
  })
  .on("error", function (error) {
    console.log(error.message);
  })
  .on("end", function () {
    const tree = StandardMerkleTree.of(whitelist, ["address"]);
    console.log('Merkle Root:', tree.root);
    fs.writeFileSync("./whitelist/tree.json", JSON.stringify(tree.dump()));
  });



