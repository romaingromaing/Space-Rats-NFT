const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const fs = require("fs");

const tree = StandardMerkleTree.load(JSON.parse(fs.readFileSync("./whitelist/tree.json")));

for (const [i, v] of tree.entries()) {
  if (v[0] === '0x70997970C51812dc3A010C7d01b50e0d17dc79C8') { //example --> insert address here
    const proof = tree.getProof(i);
    console.log('Value:', v);
    console.log('Proof:', proof);
  }
}