import Cycles "mo:base/ExperimentalCycles";
import Principal "mo:base/Principal";
import NFTActorClass "../NFT/nft";
import Debug "mo:base/Debug";
import HashMap "mo:base/HashMap";
import List "mo:base/List";
import Iter "mo:base/Iter";

actor OpenD {

    private type Listing = {
        itemOwner: Principal;
        itemPrice: Nat;
    };

    // principal of canister to actual NFT class
    var mapOfNFTs = HashMap.HashMap<Principal, NFTActorClass.NFT>(1, Principal.equal, Principal.hash);   
    
    // Principal of owner, list of princial canister
    var mapOfOwners = HashMap.HashMap<Principal, List.List<Principal>>(1, Principal.equal, Principal.hash);
    
    // Principal of NFT
    var mapOfListings = HashMap.HashMap<Principal, Listing>(1, Principal.equal, Principal.hash);

    public shared(msg) func mint(imgData: [Nat8], name: Text) : async Principal {
        // Anonymou user for now, but would need to add authentication here
        let owner : Principal = msg.caller;

        Debug.print(debug_show(Cycles.balance())); 

        // Cycles added from main canister
        Cycles.add(100_500_000_000);

        // Cycles then used here
        let newNFT = await NFTActorClass.NFT(name, owner, imgData);

        let newNFTPrincipal = await newNFT.getCanisterID();

        mapOfNFTs.put(newNFTPrincipal, newNFT);
        addToOwnershipMap(owner, newNFTPrincipal);  
        return newNFTPrincipal;
    };

    private func addToOwnershipMap(owner: Principal, nftId: Principal) {
        var ownedNFTs : List.List<Principal> = switch (mapOfOwners.get(owner)) {
            case null
                List.nil<Principal>();
            case (?result)
                result;       
        };

        ownedNFTs := List.push(nftId, ownedNFTs);

        mapOfOwners.put(owner, ownedNFTs);

    };

    public query func getOwnedNFTs(user: Principal) : async [Principal] {
        let listOfNFTs : List.List<Principal> = switch (mapOfOwners.get(user)) {
            case null 
                List.nil<Principal>();
            case (?result)
                result;
        };

        return List.toArray(listOfNFTs);
    };

    public query func getListedNFTs() : async [Principal] {
        let ids = Iter.toArray(mapOfListings.keys());
        return ids;
    };

    public shared(msg) func listItem(id: Principal, price: Nat) : async Text {
        // Users can create actors to get canister information
        // Need to access the hashmap here 
        let item : NFTActorClass.NFT = switch (mapOfNFTs.get(id)) {
            case null
                return "NFT no here";
            case (?result)
                result;
        }; 

        // need await since getOwner is async
        let owner = await item.getOwner();

        // Check the actual owner for extra security
        if (Principal.equal(owner, msg.caller)) {
            // list the item
            let newListing : Listing = {
                itemOwner = owner;
                itemPrice = price;
            };
            mapOfListings.put(id, newListing);
            return "Success";
        } else {
            return "You don't own the NFT";
        }

    };

    public query func getOpenDCanisterID() : async Principal {
        return Principal.fromActor(OpenD);
    };

    // Principal of NFT canister
    public query func isListed(id: Principal) : async Bool {
        if (mapOfListings.get(id) == null) {
            return false;
        } else {
            return true;
        }

    };

    public query func getOriginalOwner(id: Principal) : async Principal {
        let item : Listing = switch (mapOfListings.get(id)) {
            case null
                return Principal.fromText("");
            case (?result)
                result;
        };

        return item.itemOwner;
    };

    public query func getItemPrice(id: Principal) : async Nat {
        let item : Listing = switch (mapOfListings.get(id)) {
            case null
                return 0;
            case (?result)
                result;
        };

        return item.itemPrice;
    };

    public shared(msg) func completePurchase(id: Principal, ownerID: Principal, newOwnerId: Principal) : async Text {
        var purchasedNFT : NFTActorClass.NFT = switch (mapOfNFTs.get(id)) {
            case null
                return "NFT doesn't exist!";
            case (?result) 
                result;
        };

        let transferResult = await purchasedNFT.transferOwnership(newOwnerId);

        if (transferResult == "Success") {
            mapOfListings.delete(id);
            var ownNFTs : List.List<Principal> = switch (mapOfOwners.get(ownerID)) {
                case null 
                    List.nil<Principal>();
                case (?result) 
                    result;
            };

            ownNFTs := List.filter(ownNFTs, func (listItemId: Principal) : Bool {
                return listItemId != id;
            });
            addToOwnershipMap(newOwnerId, id);
            return "Success";

        } else {
            return transferResult;
        }

    };
};
