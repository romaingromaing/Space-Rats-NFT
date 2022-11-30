const { assert, expect } = require("chai");
const { network, deployments, ethers, provider } = require("hardhat")
const hre = require('hardhat')
require("@nomiclabs/hardhat-ethers");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const fs = require("fs");

describe('Space Rat NFT Unit Tests', () => {
    let deployerAsteroidMine, userAsteroidMine, deployerGeode, userGeode, deployerIridium, userIridium, deployerSpaceRats, userSpaceRats, whitelistSpaceRats;
    const tree = StandardMerkleTree.load(JSON.parse(fs.readFileSync("./whitelist/tree.json")));
    const merkleRoot = tree.root;
    const mintPrice = ethers.utils.parseEther('0.01');
    beforeEach(async () => {
        //accounts setup
        accounts = await ethers.getSigners();
        deployer = accounts[0]; //also the contract owner
        user = accounts[1]; //non-whitelisted accounts
        whitelister = accounts[2]; //whitelisted account      
        
        //Space Rats Contract Deploy
        const spaceRatsContractFactory = await hre.ethers.getContractFactory('SpaceRats');
        const spaceRatsContract = await spaceRatsContractFactory.deploy(mintPrice, merkleRoot);
        await spaceRatsContract.deployed();
        deployerSpaceRats = spaceRatsContract.connect(deployer);
        userSpaceRats = spaceRatsContract.connect(user);
        whitelistSpaceRats = spaceRatsContract.connect(whitelister);

        //Iridium Contract Deploy
        const iridiumContractFactory = await hre.ethers.getContractFactory('Iridium');
        const iridiumContract = await iridiumContractFactory.deploy();
        await iridiumContract.deployed();
        deployerIridium = iridiumContract.connect(deployer);
        userIridium = iridiumContract.connect(user);

        //Geode Contract Deploy
        const geodeContractFactory = await hre.ethers.getContractFactory('Geode');
        const geodeContract = await geodeContractFactory.deploy(iridiumContract.address);
        await geodeContract.deployed();
        deployerGeode = geodeContract.connect(deployer);
        userGeode = geodeContract.connect(user);
     
        //Asteroid Mine Contract Deploy
        const asteroidMineContractFactory = await hre.ethers.getContractFactory('AsteroidMine');
        const asteroidMineContract = await asteroidMineContractFactory.deploy(
            spaceRatsContract.address,
            iridiumContract.address,
            geodeContract.address,
            413359788359788         /*iridiumRate - subject to change. Assume a user staking 1 space rat
                                     *gets 250 iridium/1 chance at a geode per week so 250*10**18/(7*24*60*60) */
        );
        await asteroidMineContract.deployed();
        deployerAsteroidMine = asteroidMineContract.connect(deployer);
        userAsteroidMine = asteroidMineContract.connect(user);
    })
    describe('Space Rats Contract', () => {
        describe('mint function', () => {
            it('enforces public supply limit', async ()=> {
                let supply = (await deployerSpaceRats.publicSupply()).toNumber();
                let maxSupply = (await deployerSpaceRats.maxPublicSupply()).toNumber();
                while(supply < maxSupply) {
                    let tx = await deployerSpaceRats.mint({value: mintPrice});
                    await tx.wait(1);
                    supply = (await deployerSpaceRats.publicSupply()).toNumber();
                }
                await expect(deployerSpaceRats.mint({value: mintPrice})).to.be.revertedWith(
                    'mint_maxSupplyReached'
                );
            })
            it('enforces mint price', async () => {
                await expect(deployerSpaceRats.mint({value: ethers.utils.parseEther('0.5')})).to.be.revertedWith(
                    'mint_incorrectPrice'
                );
            })
            it('iterates counter with each mint', async () => {
                let lastCounter = 1
                let supply = (await deployerSpaceRats.publicSupply()).toNumber();
                while(supply < 25) {
                    let tx = await deployerSpaceRats.mint({value: mintPrice});
                    await tx.wait(1);
                    supply = (await deployerSpaceRats.publicSupply()).toNumber();
                    counter = (await deployerSpaceRats.counter()).toNumber();
                    assert.equal(counter, lastCounter + 1);
                    lastCounter = counter;
                }
            })
            it('iterates public supply with each mint', async () => {
                let lastSupply = 0
                let supply = (await deployerSpaceRats.publicSupply()).toNumber();
                while(supply < 25) {
                    let tx = await deployerSpaceRats.mint({value: mintPrice});
                    await tx.wait(1);
                    supply = (await deployerSpaceRats.publicSupply()).toNumber();
                    assert.equal(supply, lastSupply + 1);
                    lastSupply = supply;
                }
            })
            it('mints an nft and sends to the function caller', async () => {
                let tokenId = await userSpaceRats.counter();
                await (await userSpaceRats.mint({value: mintPrice})).wait(1);
                assert.equal(await userSpaceRats.ownerOf(tokenId), user.address);
            })
        })
        describe('whitelistMint functon', () => {
            it('enforces mint price', async () => {
                //generate merkle proof
                let proof;
                for (const [i, v] of tree.entries()) {
                    if (v[0] === user.address) { 
                        proof = tree.getProof(i);
                    }
                  }
                await expect(userSpaceRats.whitelistMint(proof,{value: 25})).to.be.revertedWith(
                    'mint_incorrectPrice'
                );
            })
            it("doesn't allow same spot to claim twice", async () => {
                let proof;
                for (const [i, v] of tree.entries()) {
                    if (v[0] === user.address) { 
                        proof = tree.getProof(i);
                    }
                  }
                await (await userSpaceRats.whitelistMint(proof,{value: mintPrice})).wait(1);
                await expect(userSpaceRats.whitelistMint(proof,{value: mintPrice})).to.be.revertedWith(
                    'whitelist_alreadyClaimed'
                );
            })
            it("toggles minter's spot in claimed mapping", async () => {
                //generate merkle proof
                let proof;
                for (const [i, v] of tree.entries()) {
                    if (v[0] === user.address) { 
                        proof = tree.getProof(i);
                    }
                  }
                let initialMapping = await userSpaceRats.claimed(user.address);
                assert.isFalse(initialMapping);
                await (await userSpaceRats.whitelistMint(proof,{value: mintPrice})).wait(1);
                let finalMapping = await userSpaceRats.claimed(user.address);
                assert.isTrue(finalMapping);
            })
            it('rejects an invalid merkle proof', async () => {
                let proof = [ //valid proof but changed 1 character
                    '0x28585888a13217acd1761a2294dda0e77209ad24c58c1022297f997e24bbcee9',
                    '0x185d945fad8af996c0887bb1cad4a0ba5b166d01318e4d152d00e9d0a343f693',
                    '0x0fb45f24e9dbc8d66c7b332b6b58a53124fe12babd46116a20f3aa62848e18ba',
                    '0xb4a4bce37066f04fe325a9a4261883f78b9e0e6c4d0303f0ed2de826c538c154',
                    '0x34f5d9f80426a6b6062410da0b46f288c151c886c9d4db3ba07135cb475dd175',
                    '0x8133bc6c7ecbc9fc9ca70cbaef3e11a829ffdfd41e5197fede3707246be34ade',
                    '0x76d6e84b87e21d4a2da73a8afe9d0b19772b397e90a2d086d876cc1b684d09aa',
                    '0xe559b1038c4ab98ce377b1de5e1861179bd2125beeab8b8c80a788d8745e658a'
                  ]
                await expect(userSpaceRats.whitelistMint(proof,{value: mintPrice})).to.be.revertedWith(
                    'whitelist_invalidMerkleProof'
                )
            })
            it('accepts a valid merkle proof', async () => {
                //generate merkle proof
                let proof;
                for (const [i, v] of tree.entries()) {
                    if (v[0] === user.address) { 
                        proof = tree.getProof(i);
                    }
                  }
                let initialBalance = userSpaceRats.balanceOf(user.address);
                await (await userSpaceRats.whitelistMint(proof,{value: mintPrice})).wait(1);
                let finalBalance = await userSpaceRats.balanceOf(user.address);
                assert.notEqual(initialBalance, finalBalance);
                assert.equal(finalBalance, 1);
            })
            it('iterates the counter', async () => {
                //generate merkle proof
                let proof;
                for (const [i, v] of tree.entries()) {
                    if (v[0] === user.address) { 
                        proof = tree.getProof(i);
                    }
                  }
                let initialCounter = (await userSpaceRats.counter()).toNumber();
                await (await userSpaceRats.whitelistMint(proof,{value: mintPrice})).wait(1);
                let finalCounter = (await userSpaceRats.counter()).toNumber();
                assert.equal(finalCounter, initialCounter + 1);
            })
            it('mints an nft to the function caller', async () => {
                //generate merkle proof
                let proof;
                for (const [i, v] of tree.entries()) {
                    if (v[0] === user.address) { 
                        proof = tree.getProof(i);
                    }
                  }
                let tokenId = await userSpaceRats.counter();
                await (await userSpaceRats.whitelistMint(proof,{value: mintPrice})).wait(1);
                assert.equal(await userSpaceRats.ownerOf(tokenId), user.address);
            })
        })
        describe('withdraw function', () => {
            beforeEach(async () => {
                //mint some nfts so there's eth to withdraw
                let tx = await deployerSpaceRats.mint({value: mintPrice});
                await tx.wait(1);
                tx = await deployerSpaceRats.mint({value: mintPrice});
                await tx.wait(1);
                tx = await deployerSpaceRats.mint({value: mintPrice});
                await tx.wait(1);
            })
            it('can only be successfully called by the owner', async () => {
                await expect(userSpaceRats.withdraw()).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
                await expect(whitelistSpaceRats.withdraw()).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            })
            it("sends the contract's ether balance to the caller", async () => {
                let change = ethers.utils.parseEther('0.03');
                await expect(await deployerSpaceRats.withdraw()).to.changeEtherBalance(deployer, change);
            })
        })
        describe('setBaseURI function', () => {
            it('can only be called by the owner', async () => {
                await expect(userSpaceRats.setBaseURI('12345')).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
                await expect(whitelistSpaceRats.setBaseURI('12345')).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            })
            it("can't be called after URI is frozen", async () => {
                let tx = await deployerSpaceRats.freezeURI();
                await tx.wait(1);
                await expect(deployerSpaceRats.setBaseURI('12345')).to.be.revertedWith(
                    'URI_isFrozen'
                );
            })
            it('updates the uri', async () => {
                let initialURI = await deployerSpaceRats.baseURI();
                let tx = await deployerSpaceRats.setBaseURI('12345');
                await tx.wait(1);
                let finalURI = await deployerSpaceRats.baseURI();
                assert.notEqual(initialURI, finalURI);
                assert.equal('12345', finalURI);
            })
            it('emits a newBaseURI event', async () => {
                await expect(deployerSpaceRats.setBaseURI('www.ifps.blablabla/')) 
                    .to.emit(deployerSpaceRats, 'newBaseURI')
                    .withArgs('www.ifps.blablabla/');
            })
        })
        describe('freezeURI function', () => {
            it('can only be called by the owner', async () => {
                await expect(userSpaceRats.freezeURI()).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
                await expect(whitelistSpaceRats.freezeURI()).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            })
            it("can't be called if URI is already frozen", async () => {
                let tx = await deployerSpaceRats.freezeURI();
                await tx.wait(1);
                await expect(deployerSpaceRats.freezeURI()).to.be.revertedWith(
                    'URI_alreadyFrozen'
                );
            })
            it('sets frozen to true', async () => {
                let initialFrozen = await deployerSpaceRats.frozen();
                assert.isFalse(initialFrozen);
                let tx = await deployerSpaceRats.freezeURI();
                await tx.wait(1);
                let finalFrozen = await deployerSpaceRats.frozen();
                assert.notEqual(initialFrozen,finalFrozen);
                assert.isTrue(finalFrozen);
            })
            it(' emits a URIFrozen event', async () => {
                await expect(deployerSpaceRats.freezeURI()) 
                    .to.emit(deployerSpaceRats, 'URIFrozen');
            })
        })
        describe('setNewRoyalty function', () => {
            it('can only be called by the owner', async () => {
                await expect(userSpaceRats.setNewRoyalty(500)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
                await expect(whitelistSpaceRats.setNewRoyalty(500)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            })
            it('enforces maxRoyalty', async () => {
                await expect(deployerSpaceRats.setNewRoyalty(10000000)).to.be.revertedWith(
                    'royalty_exceedsMax'
                );
            })
            it('updates the royalty', async () => {
                let initialRoyalty = (await deployerSpaceRats.royaltyInfo(1,10000))[1];
                assert.equal(initialRoyalty, 250);
                let tx = await deployerSpaceRats.setNewRoyalty(750);
                await tx.wait(1);
                let finalRoyalty = (await deployerSpaceRats.royaltyInfo(1,10000))[1];
                assert.notEqual(initialRoyalty, finalRoyalty);
                assert.equal(finalRoyalty, 750);
            })
            it('emits a newRoyaltySet event', async () => {
                await expect(deployerSpaceRats.setNewRoyalty(350)) 
                    .to.emit(deployerSpaceRats, 'newRoyaltySet')
                    .withArgs(deployer.address, 350);
            })
        })
    })
    describe('Asteroid Mine Contract', () => {
        describe('stake function', () => {
            beforeEach(async () => {
                //mint token
                let tx = await deployerSpaceRats.mint({value: mintPrice});
                await tx.wait();
                assert.equal(await deployerSpaceRats.ownerOf(1), deployer.address);
                //approve token transfer
                tx = await deployerSpaceRats.approve(deployerAsteroidMine.address, 1);
                await tx.wait(1);
            })
            it("doesn't work if the token doesn't exist", async () => {
                await expect(deployerAsteroidMine.stake(250)).to.be.revertedWith(
                    "ERC721: invalid token ID"
                )
            })
            it("doesn't work if user doesn't hold specified tokenId", async () => {
                await expect(userAsteroidMine.stake(1)).to.be.revertedWith(
                    "ERC721: transfer from incorrect owner"
                )
            })
            it('transfers token from function caller to contract', async () => {
                let initialHolder = await deployerSpaceRats.ownerOf(1);
                assert.equal(initialHolder, deployer.address);
                let tx = await deployerAsteroidMine.stake(1);
                await tx.wait(1);
                let finalHolder = await deployerSpaceRats.ownerOf(1);
                assert.notEqual(initialHolder, finalHolder);
                assert.equal(finalHolder, deployerAsteroidMine.address);
            })
            it("adds tokenId to user's staked tokens mapping array", async () => {
                let initialArray = await deployerAsteroidMine.getStakedTokenIds();
                assert.equal(initialArray.length, 0)
                let tx = await deployerAsteroidMine.stake(1);
                await tx.wait(1);
                let finalArray = await deployerAsteroidMine.getStakedTokenIds();
                assert.equal(finalArray.length,1);
                assert.equal(finalArray[0], 1);
            })
            it('updates latestTimestamps mapping for staked token', async () => {
                let initialTimestamp = await deployerAsteroidMine.latestTimestamps(1);
                assert.equal(initialTimestamp, 0);
                let tx = await deployerAsteroidMine.stake(1);
                await tx.wait(1);
                let finalTimestamp = await deployerAsteroidMine.latestTimestamps(1);
                let expectedTimestamp = (await hre.ethers.provider.getBlock("latest")).timestamp;
                assert.notEqual(initialTimestamp, finalTimestamp);
                assert.equal(expectedTimestamp, finalTimestamp);

            })
            it('emits a tokenStaked event', async () => {
                await expect(deployerAsteroidMine.stake(1)) 
                    .to.emit(deployerAsteroidMine, 'tokenStaked')
                    .withArgs(1);
            })
        })
        describe('unstake function', () => {
            beforeEach(async () => {
                //Mint NFT
                let tx = await deployerSpaceRats.mint({value: mintPrice});
                await tx.wait();
                assert.equal(await deployerSpaceRats.ownerOf(1), deployer.address);
                //approve token transfer
                tx = await deployerSpaceRats.approve(deployerAsteroidMine.address, 1);
                await tx.wait(1);
                //stake an NFT
                tx = await deployerAsteroidMine.stake(1);
                await tx.wait(1);
                //wait for time to pass so rewards can accumulate
                await network.provider.send("evm_mine"); 
            })
            it("doesn't work if user hasn't staked specified tokenId", async () => {
                await expect(userAsteroidMine.unstake(1)).to.be.revertedWith(
                    "unstake_tokenNotStakedByCaller"
                );
                await expect(deployerAsteroidMine.unstake(25)).to.be.revertedWith(
                    "unstake_tokenNotStakedByCaller"
                );
            })
            it('transfers specified NFT back to sender', async () => {
                let initialOwner = await deployerSpaceRats.ownerOf(1);
                assert.equal(initialOwner, deployerAsteroidMine.address);
                let tx = await deployerAsteroidMine.unstake(1);
                await tx.wait(1);
                let finalOwner = await deployerSpaceRats.ownerOf(1);
                assert.equal(finalOwner, deployer.address);
            })
            it("updates user's iridium balance", async () => {
                let initialIridiumBalance = await deployerAsteroidMine.iridiumBalances(deployer.address);
                let tx = await deployerAsteroidMine.unstake(1);
                await tx.wait(1);
                let finalIridiumBalance = await deployerAsteroidMine.iridiumBalances(deployer.address);
                assert.isAbove(finalIridiumBalance,initialIridiumBalance);
            })
            it('deletes entry for token id in latestTimestamps mapping', async () => {
                let initialTimestamp = await deployerAsteroidMine.latestTimestamps(1);
                let tx = await deployerAsteroidMine.unstake(1);
                await tx.wait(1);
                let finalTimestamp = await deployerAsteroidMine.latestTimestamps(1);
                assert.notEqual(initialTimestamp, finalTimestamp);
                assert.equal(finalTimestamp, 0);
            })
            it('deletes entry for tokenId in stakedTokens mapping', async () => {
                let initialArray = await deployerAsteroidMine.getStakedTokenIds();
                assert.equal(initialArray[0], 1);
                assert.equal(initialArray.length, 1);
                let tx = await deployerAsteroidMine.unstake(1);
                await tx.wait(1);
                let finalArray = await deployerAsteroidMine.getStakedTokenIds();
                // since delete in solidity returns a value to zero, the token's storage index should now hold a value of zero
                assert.equal(finalArray[0], 0);
            })
            it('emits a tokenUnstaked event', async () => {
                await expect(deployerAsteroidMine.unstake(1)) 
                    .to.emit(deployerAsteroidMine, 'tokenUnstaked')
                    .withArgs(1);
            })
        })
        describe('claim function', () => {
            beforeEach(async () => {
                //Mint NFT
                let tx = await deployerSpaceRats.mint({value: mintPrice});
                await tx.wait();
                assert.equal(await deployerSpaceRats.ownerOf(1), deployer.address);
                //approve token transfer
                tx = await deployerSpaceRats.approve(deployerAsteroidMine.address, 1);
                await tx.wait(1);
                //stake an NFT
                tx = await deployerAsteroidMine.stake(1);
                await tx.wait(1);
                //wait for time to pass so rewards can accumulate
                await network.provider.send("evm_mine"); 
                //set asteroid mine permissions for iridium and geode minting
                await deployerGeode.setMinter(deployerAsteroidMine.address);
                await (await deployerIridium.setAsteroidMine(deployerAsteroidMine.address)).wait(1);
                
            })
            it('successfully gets the updated iridium balance for the user', async () => {
                let initialBalance = await deployerAsteroidMine.iridiumBalances(deployer.address);
                let initialTokens = await deployerIridium.balanceOf(deployer.address);
                //wait for time to pass so rewards can accumulate
                await network.provider.send("evm_mine"); 
                tx = await deployerAsteroidMine.claim();
                await tx.wait(1);
                let finalTokens = await deployerIridium.balanceOf(deployer.address);
                let delta = finalTokens - initialTokens;
                assert.isAbove(delta, initialBalance);
            })
            it('resets user iridium balance to zero', async () => {
                tx = await deployerAsteroidMine.getIridiumBalance();
                await tx.wait(1);
                let initialBalance = await deployerAsteroidMine.iridiumBalances(deployer.address);
                assert.notEqual(initialBalance, 0);
                tx = await deployerAsteroidMine.claim();
                await tx.wait(1);
                let finalBalance = await deployerAsteroidMine.iridiumBalances(deployer.address);
                assert.equal(finalBalance, 0);
            })
            it('mints the accumulated iridium tokens to the user', async () => {
                let initialBalance = await deployerIridium.balanceOf(deployer.address);
                assert.equal(initialBalance, 0);
                tx = await deployerAsteroidMine.claim();
                await tx.wait(1);
                let finalBalance = await deployerIridium.balanceOf(deployer.address);
                assert.isAbove(finalBalance,initialBalance);
            })
            it('gives the user chances to win geodes, as appropriate', async () => {
                //do a huge iridium claim and make sure you get a couple geodes
                //send time forward ~ 10,000,000 seconds to accumulate iridium
                await hre.ethers.provider.send("evm_increaseTime", [10000000]);
                await network.provider.send("evm_mine");
                tx = await deployerAsteroidMine.getIridiumBalance();
                await tx.wait(1);
                // let claimSize = await deployerAsteroidMine.iridiumBalances(deployer.address);
                // console.log(`Loops to run: ${claimSize/(250*10**18)}`);
                let initialGeodeBalance = (await deployerGeode.balanceOf(deployer.address)).toNumber();
                tx = await deployerAsteroidMine.claim();
                await tx.wait(1);
                let finalGeodeBalance = (await deployerGeode.balanceOf(deployer.address)).toNumber();
                //console.log(`Geodes Earned: ${finalGeodeBalance}`);
                assert.isAbove(finalGeodeBalance, initialGeodeBalance);
            })
        })
        describe('getStakedTokenIds function', () => {
            beforeEach(async () => {
                //Mint NFTs
                for(let i = 0; i < 25; i++){
                    await (await deployerSpaceRats.mint({value: mintPrice})).wait(1);
                }
                //approve token transfer
                tx = await deployerSpaceRats.setApprovalForAll(deployerAsteroidMine.address, true);
                //stake some NFTs
                tx = await deployerAsteroidMine.stake(3);
                await tx.wait(1);
                tx = await deployerAsteroidMine.stake(7);
                await tx.wait(1);
                tx = await deployerAsteroidMine.stake(11);
                await tx.wait(1);
                tx = await deployerAsteroidMine.stake(19);
                await tx.wait(1);
                tx = await deployerAsteroidMine.stake(23);
                await tx.wait(1);
            })
            it('returns the correct array of tokenIds', async () => {
                let stakedTokens = await deployerAsteroidMine.getStakedTokenIds();
                assert.equal(stakedTokens.length, 5);
                assert.equal((stakedTokens[0]).toNumber(), 3);
                assert.equal((stakedTokens[1]).toNumber(), 7);
                assert.equal((stakedTokens[2]).toNumber(), 11);
                assert.equal((stakedTokens[3]).toNumber(), 19);
                assert.equal((stakedTokens[4]).toNumber(), 23);
            })
        })
        describe('getIridiumBalance function', () => {
            beforeEach(async () => {
                //Mint NFT
                let tx = await deployerSpaceRats.mint({value: mintPrice});
                await tx.wait();
                assert.equal(await deployerSpaceRats.ownerOf(1), deployer.address);
                //approve token transfer
                tx = await deployerSpaceRats.approve(deployerAsteroidMine.address, 1);
                await tx.wait(1);
                //stake an NFT
                tx = await deployerAsteroidMine.stake(1);
                await tx.wait(1);
            })
            it('calculates iridium rewards correctly as time increases', async () => {
                (await deployerAsteroidMine.getIridiumBalance()).wait(1);
                let initialBalance = (await deployerAsteroidMine.iridiumBalances(deployer.address)).toNumber();
                let initialRecordedTimestamp = await deployerAsteroidMine.latestTimestamps(1);
                let timeIncrease = 31;
                let iridiumRate = (await deployerAsteroidMine.iridiumRate()).toNumber();
                await hre.ethers.provider.send("evm_increaseTime", [timeIncrease]);
                await network.provider.send("evm_mine");
                (await deployerAsteroidMine.getIridiumBalance()).wait(1);
                let finalRecordedTimestamp = await deployerAsteroidMine.latestTimestamps(1);
                let expectedBalance = initialBalance +  (finalRecordedTimestamp - initialRecordedTimestamp) * iridiumRate;
                let actualBalance = await deployerAsteroidMine.iridiumBalances(deployer.address);
                assert.equal(expectedBalance.toString(), (actualBalance).toString());
            })
        })
    })
    describe('Geode contract', () => {
        beforeEach(async () => {
            //set minter - in reality it'll be the asteroid mine, but using deployer for this since it's easier
            await (await deployerGeode.setMinter(deployer.address)).wait(1);
            await (await deployerIridium.setGeode(deployerGeode.address)).wait(1);
        })
        describe('mint function', () => {
            it('can only be called by the minter', async () => {
                await expect(userGeode.mint(user.address)).to.be.revertedWith(
                    'mint_notMinter'
                );
            })
            it('iterates the counter', async () => {
                let initialCounter = (await deployerGeode.counter()).toNumber();
                assert.equal(initialCounter, 1);
                await (await deployerGeode.mint(deployer.address)).wait(1);
                let finalCounter = (await deployerGeode.counter()).toNumber();
                assert.equal(finalCounter,initialCounter + 1);
            })
            it('mints an nft to the specified address', async () => {
                let initialDeployerBalance = (await deployerGeode.balanceOf(deployer.address)).toNumber();
                assert.equal(initialDeployerBalance, 0);
                let initialUserBalance = (await deployerGeode.balanceOf(user.address)).toNumber();
                assert.equal(initialUserBalance, 0);
                await (await deployerGeode.mint(deployer.address)).wait(1);
                await (await deployerGeode.mint(user.address)).wait(1);
                let finalDeployerBalance = (await deployerGeode.balanceOf(deployer.address)).toNumber();
                let finalUserBalance = (await deployerGeode.balanceOf(user.address)).toNumber();
                assert.equal(finalDeployerBalance, initialDeployerBalance + 1);
                assert.equal(finalUserBalance, initialUserBalance + 1);
            })
        })
        describe('crack function', () => {
            beforeEach(async () => {
                for(let i = 1; i <= 100; i++) {
                    await (await deployerGeode.mint(deployer.address)).wait(1);
                }
            })
            it('burns the specified token', async () => {
                let tokenOwner = await deployerGeode.ownerOf(25);
                assert.equal(tokenOwner, deployer.address);
                await(await deployerGeode.crack(25)).wait(1);
                await expect(deployerGeode.ownerOf(25)).to.be.revertedWith(
                    'ERC721: invalid token ID'
                )
            })
            it("Handles scenerios correctly when keys and whitelist are NOT set", async () => {
                let keys = 0, whitelist = 0, irid1000 = 0, irid500 = 0, irid100 = 0;
                let tx, receipt, scenerio;
                for(let i = 1; i <= 100; i++) {
                    tx = await deployerGeode.crack(i);
                    receipt = await tx.wait(1);
                    scenerio = receipt.events[2].args.reward;
                    switch(scenerio) {
                        case 'Spaceship Keys':
                            keys++;
                            break;
                        case 'Whitelist Spot':
                            whitelist++;
                            break;
                        case '1000 Iridium':
                            irid1000++;
                            break;
                        case '500 Iridium':
                            irid500++;
                            break;
                        case '100 Iridium':
                            irid100++;
                            break;
                    }
                }
                //console.log(`Keys: ${keys}, Whitelists: ${whitelist}, Irid1000: ${irid1000}, Irid500: ${irid500}, Irid100: ${irid100}`);
                let actualBalance = (Math.floor((await deployerIridium.balanceOf(deployer.address))*10**-18)).toString();
                let expectedBalance = (1000*irid1000 + 500*irid500 + 100*irid100).toString();
                assert.equal(actualBalance, expectedBalance);
                assert.equal(keys, 0);
                assert.equal(whitelist, 0);
                assert.isAbove(irid1000, 0);
                assert.isAbove(irid500, 0);
                assert.isAbove(irid100, 0);
            })
            it("Handles scenerios correctly when keys and whitelist ARE set", async () => {
                //set spaceship keys and whitelist
                const spaceshipContractFactory = await hre.ethers.getContractFactory('Spaceship');
                const spaceshipContract = await spaceshipContractFactory.deploy();
                await spaceshipContract.deployed();
                await(await deployerGeode.setKeyAddress(spaceshipContract.address)).wait(1);

                const whitelistContractFactory = await hre.ethers.getContractFactory('Whitelist');
                const whitelistContract = await whitelistContractFactory.deploy();
                await whitelistContract.deployed();
                await (await deployerGeode.setWhitelistAddress(whitelistContract.address)).wait(1);
                        
                //counters to track num events triggered
                let keys = 0, whitelist = 0, irid1000 = 0, irid500 = 0, irid100 = 0;
                let tx, receipt, scenerio;
                for(let i = 1; i <= 100; i++) {
                    tx = await deployerGeode.crack(i);
                    receipt = await tx.wait(1);
                    scenerio = receipt.events[2].args.reward;
                    switch(scenerio) {
                        case 'Spaceship Keys':
                            keys++;
                            break;
                        case 'Whitelist Spot':
                            whitelist++;
                            break;
                        case '1000 Iridium':
                            irid1000++;
                            break;
                        case '500 Iridium':
                            irid500++;
                            break;
                        case '100 Iridium':
                            irid100++;
                            break;
                    }
                }
                //console.log(`Keys: ${keys}, Whitelists: ${whitelist}, Irid1000: ${irid1000}, Irid500: ${irid500}, Irid100: ${irid100}`);
                let actualBalance = (Math.floor((await deployerIridium.balanceOf(deployer.address))*10**-18)).toString();
                let expectedBalance = (1000*irid1000 + 500*irid500 + 100*irid100).toString();
                assert.equal(actualBalance, expectedBalance);
                let keyBalance = await spaceshipContract.connect(deployer).balanceOf(deployer.address);
                assert.equal(keyBalance, keys);
                let whitelistBalance = await whitelistContract.connect(deployer).balanceOf(deployer.address);
                assert.equal(whitelistBalance, whitelist);
                assert.isAbove(keys, 0);
                assert.isAbove(whitelist, 0);
                assert.isAbove(irid1000, 0);
                assert.isAbove(irid500, 0);
                assert.isAbove(irid100, 0);
            })
            it('emits a geodeCracked event', async () => {
                await expect(deployerGeode.crack(5)) 
                    .to.emit(deployerGeode, 'geodeCracked')
            })
        })
        describe('setMinter function', async () => {
            it('can only be called by the owner', async () => {
                await expect(userGeode.setMinter(user.address)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            })
            it('switches the minter to the specified address', async () => {
                let initialMinter = await deployerGeode.minter();
                assert.notEqual(initialMinter, deployerAsteroidMine.address);
                await (await deployerGeode.setMinter(deployerAsteroidMine.address));
                let finalMinter = await deployerGeode.minter();
                assert.equal(finalMinter, deployerAsteroidMine.address);
            })
            it('emits a newMinterSet event', async () => {
                await expect(deployerGeode.setMinter(deployerAsteroidMine.address)) 
                    .to.emit(deployerGeode, 'newMinterSet')
                    .withArgs(deployerAsteroidMine.address);
            })
        })
        describe('setKeyAddress function', () => {
            it('can only be called by the owner', async () => {
                await expect(userGeode.setKeyAddress(user.address)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            })
            it('switches the keyAddress to the specified address', async () => {
                let initialKeyAddress = await deployerGeode.keyAddress();
                assert.notEqual(initialKeyAddress, deployerAsteroidMine.address); //no key address yet so using as a placeholder
                await (await deployerGeode.setKeyAddress(deployerAsteroidMine.address));
                let finalKeyAddress = await deployerGeode.keyAddress();
                assert.equal(finalKeyAddress, deployerAsteroidMine.address);
            })
            it('emits a keyAddressSet event', async () => {
                await expect(deployerGeode.setKeyAddress(user.address)) //using user.address as a placeholder
                    .to.emit(deployerGeode, 'keyAddressSet')
                    .withArgs(user.address);
            })
        })
        describe('setWhitelistAddress function', () => {
            it('can only be called by the owner', async () => {
                await expect(userGeode.setWhitelistAddress(user.address)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                );
            })
            it('switches the whitelistAddress to the specified address', async () => {
                let initialWhitelistAddress = await deployerGeode.whitelistAddress();
                assert.notEqual(initialWhitelistAddress, deployerAsteroidMine.address); //no whitelsit address yet so using as a placeholder
                await (await deployerGeode.setWhitelistAddress(deployerAsteroidMine.address));
                let finalWhitelistAddress = await deployerGeode.whitelistAddress();
                assert.equal(finalWhitelistAddress, deployerAsteroidMine.address);
            })
            it('emits a whitelistAddressSet event', async () => {
                await expect(deployerGeode.setWhitelistAddress(user.address)) //using user.address as a placeholder
                    .to.emit(deployerGeode, 'whitelistAddressSet')
                    .withArgs(user.address);
            })
        })
    })
    describe('Iridium Contract', () => {
        beforeEach(async () => {
            //setting burner, geode and asteroidMine to user.address for ease of testing
            await (await deployerIridium.setAsteroidMine(user.address)).wait(1);
            await (await deployerIridium.setGeode(user.address)).wait(1);
            await (await deployerIridium.setBurner(user.address)).wait(1);
        })
        describe('mint function', () => {
            it('restricts access to the asteroid mine and the goede contracts', async () => {
                await expect(deployerIridium.mint(500, deployer.address)).to.be.revertedWith(
                    "mint_notAuthorized"
                )
            })
            it('mints the specified amount of iridium to the specified recipient', async () => {
                let initialBalance = (await deployerIridium.balanceOf(deployer.address)).toNumber();
                await (await userIridium.mint(500, deployer.address)).wait(1);
                let finalBalance = (await deployerIridium.balanceOf(deployer.address)).toNumber();
                assert.equal(finalBalance, initialBalance + 500);
            })
        })
        describe('burn function', () => {
            beforeEach(async () => {
                //set asteroid to deployer for easier iridium minting so there's something to burn
                await (await deployerIridium.setAsteroidMine(deployer.address)).wait(1);
                //mint some iridium to burn
                await (await deployerIridium.mint(1000000, user.address)).wait(1);
            })
            it('can only be called by the burner', async () => {
                await expect(deployerIridium.burn(100)).to.be.revertedWith(
                    'burn_notBurner'
                );
            })
            it("reverts if called with greater than caller's balance", async () => {
                await expect(userIridium.burn(10000000000)).to.be.revertedWith(
                    'ERC20: burn amount exceeds balance'
                );
            })
            it('burns the correct amount of tokens', async () => {
                let initialBalance = (await deployerIridium.balanceOf(user.address)).toNumber();
                let initialSupply = (await deployerIridium.totalSupply()).toNumber();
                let burnAmount = 50000;
                await (await userIridium.burn(burnAmount)).wait(1);
                let finalBalance = (await deployerIridium.balanceOf(user.address)).toNumber();
                let finalSupply = (await deployerIridium.totalSupply()).toNumber();
                assert.equal(initialBalance, finalBalance + burnAmount);
                assert.equal(initialSupply, finalSupply + burnAmount);
            })
        })
        describe('setBurner function', () => {
            it('can only be called by the owner', async () => {
                await expect(userIridium.setBurner(user.address)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                )
            })
            it('correctly sets the burner to the specified address', async () => {
                let initialBurner = await deployerIridium.burner();
                assert.equal(initialBurner, user.address);
                await (await deployerIridium.setBurner(deployer.address));
                let finalBurner = await deployerIridium.burner();
                assert.notEqual(initialBurner, finalBurner);
                assert.equal(finalBurner, deployer.address);
            })
            it('emits a newBurnerSet event', async () => {
                await expect(deployerIridium.setBurner(user.address)) //using user.address as a placeholder
                    .to.emit(deployerIridium, 'newBurnerSet')
                    .withArgs(user.address);
            })
        })
        describe('setAsteroidMine function', () => {
            it('can only be called by the owner', async () => {
                await expect(userIridium.setAsteroidMine(user.address)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                )
            })
            it('correctly sets the asteroid mine to the specified address', async () => {
                let initialAsteroidMine = await deployerIridium.asteroidMine();
                assert.equal(initialAsteroidMine, user.address);
                await (await deployerIridium.setAsteroidMine(deployer.address));
                let finalAsteroidMine = await deployerIridium.asteroidMine();
                assert.notEqual(initialAsteroidMine, finalAsteroidMine);
                assert.equal(finalAsteroidMine, deployer.address);
            })
            it('emits a newAsteroidMineSet event', async () => {
                await expect(deployerIridium.setAsteroidMine(deployerAsteroidMine.address)) 
                    .to.emit(deployerIridium, 'newAsteroidMineSet')
                    .withArgs(deployerAsteroidMine.address);
            })
        })
        describe('setGeode function', () => {
            it('can only be called by the owner', async () => {
                await expect(userIridium.setAsteroidMine(user.address)).to.be.revertedWith(
                    'Ownable: caller is not the owner'
                )
            })
            it('correctly sets the geode to the specified address', async () => {
                let initialGeode = await deployerIridium.geode();
                assert.equal(initialGeode, user.address);
                await (await deployerIridium.setGeode(deployer.address));
                let finalGeode = await deployerIridium.geode();
                assert.notEqual(initialGeode, finalGeode);
                assert.equal(finalGeode, deployer.address);
            })
            it('emits a geodeSet event', async () => {
                await expect(deployerIridium.setGeode(deployerGeode.address)) 
                    .to.emit(deployerIridium, 'geodeSet')
                    .withArgs(deployerGeode.address);
            })
        })
    })
})