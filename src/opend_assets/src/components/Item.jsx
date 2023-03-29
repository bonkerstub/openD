import React, { useEffect, useState } from "react";
import logo from "../../assets/logo.png";
import { Actor, HttpAgent} from "@dfinity/agent";
import {idlFactory} from "../../../declarations/nft";
import { idlFactory as tokenIdlFactory} from "../../../declarations/token";
import { Principal } from "@dfinity/principal";
import Button from "./Button";
import PriceLabel from "./PriceLabel";
import { opend } from "../../../declarations/opend";
import CURRENT_USER_ID from "../index";

function Item(props) {

  const [sellStatus, setSellStatus] = useState("");
  const [name, setName] = useState();
  const [userID, setUserId] = useState();
  const [image, setImage] = useState();
  const [button, setButton] = useState();
  const [priceInput, setPriceInput] = useState();
  const [loaderHidden, setLoaderHidden] = useState(true);
  const [blur, setBlur] = useState();
  const [priceLabel, setPriceLabel] = useState();
  const [shouldDisplay, setDisplay] = useState(true);

  const id = props.id;
   
  const localHost = "http://localhost:8080";

  const agent = new HttpAgent({host: localHost});
  
  // THIS IS ONLY NEEDED FOR LOCAL DEVELOPMENT
  agent.fetchRootKey();
  let nftActor;

  async function loadNFT() {
    nftActor = await Actor.createActor(idlFactory, {
      agent,
      canisterId: id,
    })

    const name = await nftActor.getName();
    const userID = (await nftActor.getOwner()).toText();
    
    // Need to convert nat8 array to an uint8array element, then convert that to blob to then be converted to
    // a URL for html to use
    const imageData = await nftActor.getAsset();
    const imageArray = new Uint8Array(imageData);
    const image = URL.createObjectURL(new Blob([imageArray.buffer], {type: "image/png"}));

    setName(name);
    setImage(image);
    setUserId(userID);

    if (props.role == "Collection") {
      const nftIisListed = await opend.isListed(id);
      if (nftIisListed) {
        setBlur({filter: "blur(4px)"}); 
        setUserId("OpenD");
        setSellStatus("Listed");
      } else {
        setButton(<Button handleClick={handleSell} text="Sell"/>)      
      } 
    } else if ( props.role == "Discover") {
      const originalOwner = await opend.getOriginalOwner(props.id);

      if (originalOwner.toText() != CURRENT_USER_ID.toText()) {
        setButton(<Button handleClick={handleBuy} text="Buy"/>)
      }

      const price = await opend.getItemPrice(props.id);
      setPriceLabel(<PriceLabel cost={price.toString()}/>);
    }
  }

  // empty array is what' 
  useEffect(() => {
    loadNFT();0
  }, []);

  let price;

  function handleSell() {
    console.log("Sell clicked!");
    setPriceInput(<input
      placeholder="Price in BONK"
      type="number"
      className="price-input"
      value={price}
      onChange={(e) => price=e.target.value}
    />)
    setButton(<Button handleClick={sellItem} text="Confirm"/>)
  }

  async function sellItem() {
    setBlur({filter: "blur(4px)"}); 
    setLoaderHidden(false);
    console.log("Confirm clicked!");
    console.log(price);
    const result = await opend.listItem(props.id, Number(price));
    console.log(result);
    if (result == "Success") {
      const openDId = await opend.getOpenDCanisterID(); 
      const transferResult = await nftActor.transferOwnership(openDId);
      console.log(transferResult);
      if (transferResult == "Success") {
        setButton();
        setPriceInput();
        setUserId("OpenD");
        setSellStatus("Listed");
      }
    }
    setLoaderHidden(true);
  }

  async function handleBuy() {
    console.log("triggered");
    setLoaderHidden(false);
    const tokenActor = await Actor.createActor(tokenIdlFactory, {
      agent, 
      canisterId: Principal.fromText("renrk-eyaaa-aaaaa-aaada-cai"),
    });

    const sellersID = await opend.getOriginalOwner(props.id);
    const price = await opend.getItemPrice(props.id);

    let status = await tokenActor.transfer(sellersID, price);
    if (status == "Success") {
      const transferResult = await opend.completePurchase(props.id, sellersID, CURRENT_USER_ID);
      console.log("Purchase : " + transferResult); 
      setDisplay(false);
    }
    setLoaderHidden(true);
  }

  return (
    <div style={{display: shouldDisplay ? "inline" : "none"}} className="disGrid-item">
      <div className="disPaper-root disCard-root makeStyles-root-17 disPaper-elevation1 disPaper-rounded">
        <img
          className="disCardMedia-root makeStyles-image-19 disCardMedia-media disCardMedia-img"
          src={image}
          style={blur}
        />
        <div hidden={loaderHidden} className="lds-ellipsis">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
        <div className="disCardContent-root">
          {priceLabel}
          <h2 className="disTypography-root makeStyles-bodyText-24 disTypography-h5 disTypography-gutterBottom">
            {name}<span className="purple-text"> {sellStatus}</span>
          </h2>
          <p className="disTypography-root makeStyles-bodyText-24 disTypography-body2 disTypography-colorTextSecondary">
            Owner: {userID}
          </p>
          {priceInput}
          {button}
        </div>
      </div>
    </div>
  );
}

export default Item;
 