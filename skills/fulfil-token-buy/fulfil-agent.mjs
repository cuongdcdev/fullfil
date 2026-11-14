#!/usr/bin/env node
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod3) => function __require2() {
  try {
    return mod3 || (0, cb[__getOwnPropNames(cb)[0]])((mod3 = { exports: {} }).exports, mod3), mod3.exports;
  } catch (e) {
    throw mod3 = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod3, isNodeMode, target) => (target = mod3 != null ? __create(__getProtoOf(mod3)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod3 || !mod3.__esModule ? __defProp(target, "default", { value: mod3, enumerable: true }) : target,
  mod3
));

// node_modules/.pnpm/is-property@1.0.2/node_modules/is-property/is-property.js
var require_is_property = __commonJS({
  "node_modules/.pnpm/is-property@1.0.2/node_modules/is-property/is-property.js"(exports, module) {
    "use strict";
    function isProperty(str) {
      return /^[$A-Z\_a-z\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc][$A-Z\_a-z\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc0-9\u0300-\u036f\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u0669\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u06f0-\u06f9\u0711\u0730-\u074a\u07a6-\u07b0\u07c0-\u07c9\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0859-\u085b\u08e4-\u08fe\u0900-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09cb-\u09cd\u09d7\u09e2\u09e3\u09e6-\u09ef\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c3e-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0ce6-\u0cef\u0d02\u0d03\u0d3e-\u0d44\u0d46-\u0d48\u0d4a-\u0d4d\u0d57\u0d62\u0d63\u0d66-\u0d6f\u0d82\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0e50-\u0e59\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e\u0f3f\u0f71-\u0f84\u0f86\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u102b-\u103e\u1040-\u1049\u1056-\u1059\u105e-\u1060\u1062-\u1064\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b4-\u17d3\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u18a9\u1920-\u192b\u1930-\u193b\u1946-\u194f\u19b0-\u19c0\u19c8\u19c9\u19d0-\u19d9\u1a17-\u1a1b\u1a55-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1b00-\u1b04\u1b34-\u1b44\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1b82\u1ba1-\u1bad\u1bb0-\u1bb9\u1be6-\u1bf3\u1c24-\u1c37\u1c40-\u1c49\u1c50-\u1c59\u1cd0-\u1cd2\u1cd4-\u1ce8\u1ced\u1cf2-\u1cf4\u1dc0-\u1de6\u1dfc-\u1dff\u200c\u200d\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2cef-\u2cf1\u2d7f\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua620-\ua629\ua66f\ua674-\ua67d\ua69f\ua6f0\ua6f1\ua802\ua806\ua80b\ua823-\ua827\ua880\ua881\ua8b4-\ua8c4\ua8d0-\ua8d9\ua8e0-\ua8f1\ua900-\ua909\ua926-\ua92d\ua947-\ua953\ua980-\ua983\ua9b3-\ua9c0\ua9d0-\ua9d9\uaa29-\uaa36\uaa43\uaa4c\uaa4d\uaa50-\uaa59\uaa7b\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uaaeb-\uaaef\uaaf5\uaaf6\uabe3-\uabea\uabec\uabed\uabf0-\uabf9\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f]*$/.test(str);
    }
    module.exports = isProperty;
  }
});

// node_modules/.pnpm/generate-object-property@1.2.0/node_modules/generate-object-property/index.js
var require_generate_object_property = __commonJS({
  "node_modules/.pnpm/generate-object-property@1.2.0/node_modules/generate-object-property/index.js"(exports, module) {
    var isProperty = require_is_property();
    var gen = function(obj, prop) {
      return isProperty(prop) ? obj + "." + prop : obj + "[" + JSON.stringify(prop) + "]";
    };
    gen.valid = isProperty;
    gen.property = function(prop) {
      return isProperty(prop) ? prop : JSON.stringify(prop);
    };
    module.exports = gen;
  }
});

// node_modules/.pnpm/generate-function@2.3.1/node_modules/generate-function/index.js
var require_generate_function = __commonJS({
  "node_modules/.pnpm/generate-function@2.3.1/node_modules/generate-function/index.js"(exports, module) {
    var util = __require("util");
    var isProperty = require_is_property();
    var INDENT_START = /[\{\[]/;
    var INDENT_END = /[\}\]]/;
    var RESERVED = [
      "do",
      "if",
      "in",
      "for",
      "let",
      "new",
      "try",
      "var",
      "case",
      "else",
      "enum",
      "eval",
      "null",
      "this",
      "true",
      "void",
      "with",
      "await",
      "break",
      "catch",
      "class",
      "const",
      "false",
      "super",
      "throw",
      "while",
      "yield",
      "delete",
      "export",
      "import",
      "public",
      "return",
      "static",
      "switch",
      "typeof",
      "default",
      "extends",
      "finally",
      "package",
      "private",
      "continue",
      "debugger",
      "function",
      "arguments",
      "interface",
      "protected",
      "implements",
      "instanceof",
      "NaN",
      "undefined"
    ];
    var RESERVED_MAP = {};
    for (i = 0; i < RESERVED.length; i++) {
      RESERVED_MAP[RESERVED[i]] = true;
    }
    var i;
    var isVariable = function(name) {
      return isProperty(name) && !RESERVED_MAP.hasOwnProperty(name);
    };
    var formats = {
      s: function(s) {
        return "" + s;
      },
      d: function(d) {
        return "" + Number(d);
      },
      o: function(o) {
        return JSON.stringify(o);
      }
    };
    var genfun = function() {
      var lines = [];
      var indent = 0;
      var vars = {};
      var push = function(str) {
        var spaces = "";
        while (spaces.length < indent * 2) spaces += "  ";
        lines.push(spaces + str);
      };
      var pushLine = function(line2) {
        if (INDENT_END.test(line2.trim()[0]) && INDENT_START.test(line2[line2.length - 1])) {
          indent--;
          push(line2);
          indent++;
          return;
        }
        if (INDENT_START.test(line2[line2.length - 1])) {
          push(line2);
          indent++;
          return;
        }
        if (INDENT_END.test(line2.trim()[0])) {
          indent--;
          push(line2);
          return;
        }
        push(line2);
      };
      var line = function(fmt) {
        if (!fmt) return line;
        if (arguments.length === 1 && fmt.indexOf("\n") > -1) {
          var lines2 = fmt.trim().split("\n");
          for (var i2 = 0; i2 < lines2.length; i2++) {
            pushLine(lines2[i2].trim());
          }
        } else {
          pushLine(util.format.apply(util, arguments));
        }
        return line;
      };
      line.scope = {};
      line.formats = formats;
      line.sym = function(name) {
        if (!name || !isVariable(name)) name = "tmp";
        if (!vars[name]) vars[name] = 0;
        return name + (vars[name]++ || "");
      };
      line.property = function(obj, name) {
        if (arguments.length === 1) {
          name = obj;
          obj = "";
        }
        name = name + "";
        if (isProperty(name)) return obj ? obj + "." + name : name;
        return obj ? obj + "[" + JSON.stringify(name) + "]" : JSON.stringify(name);
      };
      line.toString = function() {
        return lines.join("\n");
      };
      line.toFunction = function(scope) {
        if (!scope) scope = {};
        var src = "return (" + line.toString() + ")";
        Object.keys(line.scope).forEach(function(key) {
          if (!scope[key]) scope[key] = line.scope[key];
        });
        var keys = Object.keys(scope).map(function(key) {
          return key;
        });
        var vals = keys.map(function(key) {
          return scope[key];
        });
        return Function.apply(null, keys.concat(src)).apply(null, vals);
      };
      if (arguments.length) line.apply(null, arguments);
      return line;
    };
    genfun.formats = formats;
    module.exports = genfun;
  }
});

// node_modules/.pnpm/jsonpointer@5.0.1/node_modules/jsonpointer/jsonpointer.js
var require_jsonpointer = __commonJS({
  "node_modules/.pnpm/jsonpointer@5.0.1/node_modules/jsonpointer/jsonpointer.js"(exports) {
    var hasExcape = /~/;
    var escapeMatcher = /~[01]/g;
    function escapeReplacer(m) {
      switch (m) {
        case "~1":
          return "/";
        case "~0":
          return "~";
      }
      throw new Error("Invalid tilde escape: " + m);
    }
    function untilde(str) {
      if (!hasExcape.test(str)) return str;
      return str.replace(escapeMatcher, escapeReplacer);
    }
    function setter(obj, pointer, value) {
      var part;
      var hasNextPart;
      for (var p = 1, len = pointer.length; p < len; ) {
        if (pointer[p] === "constructor" || pointer[p] === "prototype" || pointer[p] === "__proto__") return obj;
        part = untilde(pointer[p++]);
        hasNextPart = len > p;
        if (typeof obj[part] === "undefined") {
          if (Array.isArray(obj) && part === "-") {
            part = obj.length;
          }
          if (hasNextPart) {
            if (pointer[p] !== "" && pointer[p] < Infinity || pointer[p] === "-") obj[part] = [];
            else obj[part] = {};
          }
        }
        if (!hasNextPart) break;
        obj = obj[part];
      }
      var oldValue = obj[part];
      if (value === void 0) delete obj[part];
      else obj[part] = value;
      return oldValue;
    }
    function compilePointer(pointer) {
      if (typeof pointer === "string") {
        pointer = pointer.split("/");
        if (pointer[0] === "") return pointer;
        throw new Error("Invalid JSON pointer.");
      } else if (Array.isArray(pointer)) {
        for (const part of pointer) {
          if (typeof part !== "string" && typeof part !== "number") {
            throw new Error("Invalid JSON pointer. Must be of type string or number.");
          }
        }
        return pointer;
      }
      throw new Error("Invalid JSON pointer.");
    }
    function get(obj, pointer) {
      if (typeof obj !== "object") throw new Error("Invalid input object.");
      pointer = compilePointer(pointer);
      var len = pointer.length;
      if (len === 1) return obj;
      for (var p = 1; p < len; ) {
        obj = obj[untilde(pointer[p++])];
        if (len === p) return obj;
        if (typeof obj !== "object" || obj === null) return void 0;
      }
    }
    function set(obj, pointer, value) {
      if (typeof obj !== "object") throw new Error("Invalid input object.");
      pointer = compilePointer(pointer);
      if (pointer.length === 0) throw new Error("Invalid JSON pointer for set.");
      return setter(obj, pointer, value);
    }
    function compile(pointer) {
      var compiled = compilePointer(pointer);
      return {
        get: function(object) {
          return get(object, compiled);
        },
        set: function(object, value) {
          return set(object, compiled, value);
        }
      };
    }
    exports.get = get;
    exports.set = set;
    exports.compile = compile;
  }
});

// node_modules/.pnpm/xtend@4.0.2/node_modules/xtend/immutable.js
var require_immutable = __commonJS({
  "node_modules/.pnpm/xtend@4.0.2/node_modules/xtend/immutable.js"(exports, module) {
    module.exports = extend;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    function extend() {
      var target = {};
      for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    }
  }
});

// node_modules/.pnpm/is-my-ip-valid@1.0.1/node_modules/is-my-ip-valid/index.js
var require_is_my_ip_valid = __commonJS({
  "node_modules/.pnpm/is-my-ip-valid@1.0.1/node_modules/is-my-ip-valid/index.js"(exports, module) {
    var reIpv4FirstPass = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    var reSubnetString = /\/\d{1,3}(?=%|$)/;
    var reForwardSlash = /\//;
    var reZone = /%.*$/;
    var reBadCharacters = /([^0-9a-f:/%])/i;
    var reBadAddress = /([0-9a-f]{5,}|:{3,}|[^:]:$|^:[^:]|\/$)/i;
    function validate4(input) {
      if (!reIpv4FirstPass.test(input)) return false;
      var parts = input.split(".");
      if (parts.length !== 4) return false;
      if (parts[0][0] === "0" && parts[0].length > 1) return false;
      if (parts[1][0] === "0" && parts[1].length > 1) return false;
      if (parts[2][0] === "0" && parts[2].length > 1) return false;
      if (parts[3][0] === "0" && parts[3].length > 1) return false;
      var n0 = Number(parts[0]);
      var n1 = Number(parts[1]);
      var n2 = Number(parts[2]);
      var n3 = Number(parts[3]);
      return n0 >= 0 && n0 < 256 && n1 >= 0 && n1 < 256 && n2 >= 0 && n2 < 256 && n3 >= 0 && n3 < 256;
    }
    function validate6(input) {
      var withoutSubnet = input.replace(reSubnetString, "");
      var hasSubnet = input.length !== withoutSubnet.length;
      if (hasSubnet) return false;
      if (!hasSubnet) {
        if (reForwardSlash.test(input)) return false;
      }
      var withoutZone = withoutSubnet.replace(reZone, "");
      var lastPartSeparator = withoutZone.lastIndexOf(":");
      if (lastPartSeparator === -1) return false;
      var lastPart = withoutZone.substring(lastPartSeparator + 1);
      var hasV4Part = validate4(lastPart);
      var address = hasV4Part ? withoutZone.substring(0, lastPartSeparator + 1) + "1234:5678" : withoutZone;
      if (reBadCharacters.test(address)) return false;
      if (reBadAddress.test(address)) return false;
      var halves = address.split("::");
      if (halves.length > 2) return false;
      if (halves.length === 2) {
        var first = halves[0] === "" ? [] : halves[0].split(":");
        var last = halves[1] === "" ? [] : halves[1].split(":");
        var remainingLength = 8 - (first.length + last.length);
        if (remainingLength <= 0) return false;
      } else {
        if (address.split(":").length !== 8) return false;
      }
      return true;
    }
    function validate(input) {
      return validate4(input) || validate6(input);
    }
    module.exports = function validator2(options) {
      if (!options) options = {};
      if (options.version === 4) return validate4;
      if (options.version === 6) return validate6;
      if (options.version == null) return validate;
      throw new Error("Unknown version: " + options.version);
    };
    module.exports["__all_regexes__"] = [
      reIpv4FirstPass,
      reSubnetString,
      reForwardSlash,
      reZone,
      reBadCharacters,
      reBadAddress
    ];
  }
});

// node_modules/.pnpm/is-my-json-valid@2.20.6/node_modules/is-my-json-valid/formats.js
var require_formats = __commonJS({
  "node_modules/.pnpm/is-my-json-valid@2.20.6/node_modules/is-my-json-valid/formats.js"(exports) {
    var createIpValidator = require_is_my_ip_valid();
    var reEmailWhitespace = /\s/;
    var reHostnameFirstPass = /^[a-zA-Z0-9.-]+$/;
    var reHostnamePart = /^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])$/;
    var rePhoneFirstPass = /^\+[0-9][0-9 ]{5,27}[0-9]$/;
    var rePhoneDoubleSpace = / {2}/;
    var rePhoneGlobalSpace = / /g;
    exports["date-time"] = /^\d{4}-(?:0[0-9]{1}|1[0-2]{1})-[0-9]{2}[tT ]\d{2}:\d{2}:\d{2}(?:\.\d+|)([zZ]|[+-]\d{2}:\d{2})$/;
    exports["date"] = /^\d{4}-(?:0[0-9]{1}|1[0-2]{1})-[0-9]{2}$/;
    exports["time"] = /^\d{2}:\d{2}:\d{2}$/;
    exports["email"] = function(input) {
      return input.indexOf("@") !== -1 && !reEmailWhitespace.test(input);
    };
    exports["ip-address"] = exports["ipv4"] = createIpValidator({ version: 4 });
    exports["ipv6"] = createIpValidator({ version: 6 });
    exports["uri"] = /^[a-zA-Z][a-zA-Z0-9+\-.]*:[^\s]*$/;
    exports["color"] = /(#?([0-9A-Fa-f]{3,6})\b)|(aqua)|(black)|(blue)|(fuchsia)|(gray)|(green)|(lime)|(maroon)|(navy)|(olive)|(orange)|(purple)|(red)|(silver)|(teal)|(white)|(yellow)|(rgb\(\s*\b([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\b\s*,\s*\b([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\b\s*,\s*\b([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\b\s*\))|(rgb\(\s*(\d?\d%|100%)+\s*,\s*(\d?\d%|100%)+\s*,\s*(\d?\d%|100%)+\s*\))/;
    exports["hostname"] = function(input) {
      if (!reHostnameFirstPass.test(input)) return false;
      var parts = input.split(".");
      for (var i = 0; i < parts.length; i++) {
        if (!reHostnamePart.test(parts[i])) return false;
      }
      return true;
    };
    exports["alpha"] = /^[a-zA-Z]+$/;
    exports["alphanumeric"] = /^[a-zA-Z0-9]+$/;
    exports["style"] = /.:\s*[^;]/g;
    exports["phone"] = function(input) {
      if (!rePhoneFirstPass.test(input)) return false;
      if (rePhoneDoubleSpace.test(input)) return false;
      var digits = input.substring(1).replace(rePhoneGlobalSpace, "").length;
      return digits >= 7 && digits <= 15;
    };
    exports["utc-millisec"] = /^[0-9]{1,15}\.?[0-9]{0,15}$/;
  }
});

// node_modules/.pnpm/is-my-json-valid@2.20.6/node_modules/is-my-json-valid/index.js
var require_is_my_json_valid = __commonJS({
  "node_modules/.pnpm/is-my-json-valid@2.20.6/node_modules/is-my-json-valid/index.js"(exports, module) {
    var genobj = require_generate_object_property();
    var genfun = require_generate_function();
    var jsonpointer = require_jsonpointer();
    var xtend = require_immutable();
    var formats = require_formats();
    var get = function(obj, additionalSchemas, ptr) {
      var visit = function(sub) {
        if (sub && sub.id === ptr) return sub;
        if (typeof sub !== "object" || !sub) return null;
        return Object.keys(sub).reduce(function(res2, k) {
          return res2 || visit(sub[k]);
        }, null);
      };
      var res = visit(obj);
      if (res) return res;
      ptr = ptr.replace(/^#/, "");
      ptr = ptr.replace(/\/$/, "");
      try {
        return jsonpointer.get(obj, decodeURI(ptr));
      } catch (err) {
        var end = ptr.indexOf("#");
        var other;
        if (end !== 0) {
          if (end === -1) {
            other = additionalSchemas[ptr];
          } else {
            var ext = ptr.slice(0, end);
            other = additionalSchemas[ext];
            var fragment = ptr.slice(end).replace(/^#/, "");
            try {
              return jsonpointer.get(other, fragment);
            } catch (err2) {
            }
          }
        } else {
          other = additionalSchemas[ptr];
        }
        return other || null;
      }
    };
    var types = {};
    types.any = function() {
      return "true";
    };
    types.null = function(name) {
      return name + " === null";
    };
    types.boolean = function(name) {
      return "typeof " + name + ' === "boolean"';
    };
    types.array = function(name) {
      return "Array.isArray(" + name + ")";
    };
    types.object = function(name) {
      return "typeof " + name + ' === "object" && ' + name + " && !Array.isArray(" + name + ")";
    };
    types.number = function(name) {
      return "typeof " + name + ' === "number" && isFinite(' + name + ")";
    };
    types.integer = function(name) {
      return "typeof " + name + ' === "number" && (Math.floor(' + name + ") === " + name + " || " + name + " > 9007199254740992 || " + name + " < -9007199254740992)";
    };
    types.string = function(name) {
      return "typeof " + name + ' === "string"';
    };
    var unique = function(array, len) {
      len = Math.min(len === -1 ? array.length : len, array.length);
      var list = [];
      for (var i = 0; i < len; i++) {
        list.push(typeof array[i] === "object" ? JSON.stringify(array[i]) : array[i]);
      }
      for (var i = 1; i < list.length; i++) {
        if (list.indexOf(list[i]) !== i) return false;
      }
      return true;
    };
    var isMultipleOf = function(name, multipleOf) {
      var res;
      var factor = (multipleOf | 0) !== multipleOf ? Math.pow(10, multipleOf.toString().split(".").pop().length) : 1;
      if (factor > 1) {
        var factorName = (name | 0) !== name ? Math.pow(10, name.toString().split(".").pop().length) : 1;
        if (factorName > factor) res = true;
        else res = Math.round(factor * name) % (factor * multipleOf);
      } else res = name % multipleOf;
      return !res;
    };
    var testLimitedRegex = function(r, s, maxLength) {
      if (maxLength > -1 && s.length > maxLength) return true;
      return r.test(s);
    };
    var compile = function(schema, cache, root, reporter, opts) {
      var fmts = opts ? xtend(formats, opts.formats) : formats;
      var scope = { unique, formats: fmts, isMultipleOf, testLimitedRegex };
      var verbose = opts ? !!opts.verbose : false;
      var greedy = opts && opts.greedy !== void 0 ? opts.greedy : false;
      var syms = {};
      var allocated = [];
      var gensym = function(name) {
        var res = name + (syms[name] = (syms[name] || 0) + 1);
        allocated.push(res);
        return res;
      };
      var formatName = function(field) {
        var s = JSON.stringify(field);
        try {
          var pattern = /\[([^\[\]"]+)\]/;
          while (pattern.test(s)) s = s.replace(pattern, replacer);
          return s;
        } catch (_) {
          return JSON.stringify(field);
        }
        function replacer(match, v) {
          if (allocated.indexOf(v) === -1) throw new Error("Unreplaceable");
          return '." + ' + v + ' + "';
        }
      };
      var reversePatterns = {};
      var patterns = function(p) {
        if (reversePatterns[p]) return reversePatterns[p];
        var n = gensym("pattern");
        scope[n] = new RegExp(p);
        reversePatterns[p] = n;
        return n;
      };
      var vars = ["i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "x", "y", "z"];
      var genloop = function() {
        var v = vars.shift();
        vars.push(v + v[0]);
        allocated.push(v);
        return v;
      };
      var visit = function(name, node, reporter2, filter, schemaPath) {
        var properties = node.properties;
        var type = node.type;
        var tuple = false;
        if (Array.isArray(node.items)) {
          properties = {};
          node.items.forEach(function(item, i2) {
            properties[i2] = item;
          });
          type = "array";
          tuple = true;
        }
        var indent = 0;
        var error = function(msg, prop, value) {
          validate("errors++");
          if (reporter2 === true) {
            validate("if (validate.errors === null) validate.errors = []");
            if (verbose) {
              validate(
                "validate.errors.push({field:%s,message:%s,value:%s,type:%s,schemaPath:%s})",
                formatName(prop || name),
                JSON.stringify(msg),
                value || name,
                JSON.stringify(type),
                JSON.stringify(schemaPath)
              );
            } else {
              validate("validate.errors.push({field:%s,message:%s})", formatName(prop || name), JSON.stringify(msg));
            }
          }
        };
        if (node.required === true) {
          indent++;
          validate("if (%s === undefined) {", name);
          error("is required");
          validate("} else {");
        } else {
          indent++;
          validate("if (%s !== undefined) {", name);
        }
        var valid = [].concat(type).map(function(t) {
          if (t && !types.hasOwnProperty(t)) {
            throw new Error("Unknown type: " + t);
          }
          return types[t || "any"](name);
        }).join(" || ") || "true";
        if (valid !== "true") {
          indent++;
          validate("if (!(%s)) {", valid);
          error("is the wrong type");
          validate("} else {");
        }
        if (tuple) {
          if (node.additionalItems === false) {
            validate("if (%s.length > %d) {", name, node.items.length);
            error("has additional items");
            validate("}");
          } else if (node.additionalItems) {
            var i = genloop();
            validate("for (var %s = %d; %s < %s.length; %s++) {", i, node.items.length, i, name, i);
            visit(name + "[" + i + "]", node.additionalItems, reporter2, filter, schemaPath.concat("additionalItems"));
            validate("}");
          }
        }
        if (node.format && fmts[node.format]) {
          if (type !== "string" && formats[node.format]) validate("if (%s) {", types.string(name));
          var n = gensym("format");
          scope[n] = fmts[node.format];
          if (typeof scope[n] === "function") validate("if (!%s(%s)) {", n, name);
          else validate("if (!testLimitedRegex(%s, %s, %d)) {", n, name, typeof node.maxLength === "undefined" ? -1 : node.maxLength);
          error("must be " + node.format + " format");
          validate("}");
          if (type !== "string" && formats[node.format]) validate("}");
        }
        if (Array.isArray(node.required)) {
          var n = gensym("missing");
          validate("var %s = 0", n);
          var checkRequired = function(req) {
            var prop = genobj(name, req);
            validate("if (%s === undefined) {", prop);
            error("is required", prop);
            validate("%s++", n);
            validate("}");
          };
          validate("if ((%s)) {", type !== "object" ? types.object(name) : "true");
          node.required.map(checkRequired);
          validate("}");
          if (!greedy) {
            validate("if (%s === 0) {", n);
            indent++;
          }
        }
        if (node.uniqueItems) {
          if (type !== "array") validate("if (%s) {", types.array(name));
          validate("if (!(unique(%s, %d))) {", name, node.maxItems || -1);
          error("must be unique");
          validate("}");
          if (type !== "array") validate("}");
        }
        if (node.enum) {
          var complex = node.enum.some(function(e) {
            return typeof e === "object";
          });
          var compare = complex ? function(e) {
            return "JSON.stringify(" + name + ") !== JSON.stringify(" + JSON.stringify(e) + ")";
          } : function(e) {
            return name + " !== " + JSON.stringify(e);
          };
          validate("if (%s) {", node.enum.map(compare).join(" && ") || "false");
          error("must be an enum value");
          validate("}");
        }
        if (node.dependencies) {
          if (type !== "object") validate("if (%s) {", types.object(name));
          Object.keys(node.dependencies).forEach(function(key) {
            var deps = node.dependencies[key];
            if (typeof deps === "string") deps = [deps];
            var exists = function(k) {
              return genobj(name, k) + " !== undefined";
            };
            if (Array.isArray(deps)) {
              validate("if (%s !== undefined && !(%s)) {", genobj(name, key), deps.map(exists).join(" && ") || "true");
              error("dependencies not set");
              validate("}");
            }
            if (typeof deps === "object") {
              validate("if (%s !== undefined) {", genobj(name, key));
              visit(name, deps, reporter2, filter, schemaPath.concat(["dependencies", key]));
              validate("}");
            }
          });
          if (type !== "object") validate("}");
        }
        if (node.additionalProperties || node.additionalProperties === false) {
          if (type !== "object") validate("if (%s) {", types.object(name));
          var i = genloop();
          var keys = gensym("keys");
          var toCompare = function(p2) {
            return keys + "[" + i + "] !== " + JSON.stringify(p2);
          };
          var toTest = function(p2) {
            return "!" + patterns(p2) + ".test(" + keys + "[" + i + "])";
          };
          var additionalProp = Object.keys(properties || {}).map(toCompare).concat(Object.keys(node.patternProperties || {}).map(toTest)).join(" && ") || "true";
          validate("var %s = Object.keys(%s)", keys, name)("for (var %s = 0; %s < %s.length; %s++) {", i, i, keys, i)("if (%s) {", additionalProp);
          if (node.additionalProperties === false) {
            if (filter) validate("delete %s", name + "[" + keys + "[" + i + "]]");
            error("has additional properties", null, JSON.stringify(name + ".") + " + " + keys + "[" + i + "]");
          } else {
            visit(name + "[" + keys + "[" + i + "]]", node.additionalProperties, reporter2, filter, schemaPath.concat(["additionalProperties"]));
          }
          validate("}")("}");
          if (type !== "object") validate("}");
        }
        if (node.$ref) {
          var sub = get(root, opts && opts.schemas || {}, node.$ref);
          if (sub) {
            var fn = cache[node.$ref];
            if (!fn) {
              cache[node.$ref] = function proxy(data) {
                return fn(data);
              };
              fn = compile(sub, cache, root, false, opts);
            }
            var n = gensym("ref");
            scope[n] = fn;
            validate("if (!(%s(%s))) {", n, name);
            error("referenced schema does not match");
            validate("}");
          }
        }
        if (node.not) {
          var prev = gensym("prev");
          validate("var %s = errors", prev);
          visit(name, node.not, false, filter, schemaPath.concat("not"));
          validate("if (%s === errors) {", prev);
          error("negative schema matches");
          validate("} else {")("errors = %s", prev)("}");
        }
        if (node.items && !tuple) {
          if (type !== "array") validate("if (%s) {", types.array(name));
          var i = genloop();
          validate("for (var %s = 0; %s < %s.length; %s++) {", i, i, name, i);
          visit(name + "[" + i + "]", node.items, reporter2, filter, schemaPath.concat("items"));
          validate("}");
          if (type !== "array") validate("}");
        }
        if (node.patternProperties) {
          if (type !== "object") validate("if (%s) {", types.object(name));
          var keys = gensym("keys");
          var i = genloop();
          validate("var %s = Object.keys(%s)", keys, name)("for (var %s = 0; %s < %s.length; %s++) {", i, i, keys, i);
          Object.keys(node.patternProperties).forEach(function(key) {
            var p2 = patterns(key);
            validate("if (%s.test(%s)) {", p2, keys + "[" + i + "]");
            visit(name + "[" + keys + "[" + i + "]]", node.patternProperties[key], reporter2, filter, schemaPath.concat(["patternProperties", key]));
            validate("}");
          });
          validate("}");
          if (type !== "object") validate("}");
        }
        if (node.pattern) {
          var p = patterns(node.pattern);
          if (type !== "string") validate("if (%s) {", types.string(name));
          validate("if (!(testLimitedRegex(%s, %s, %d))) {", p, name, typeof node.maxLength === "undefined" ? -1 : node.maxLength);
          error("pattern mismatch");
          validate("}");
          if (type !== "string") validate("}");
        }
        if (node.allOf) {
          node.allOf.forEach(function(sch, key) {
            visit(name, sch, reporter2, filter, schemaPath.concat(["allOf", key]));
          });
        }
        if (node.anyOf && node.anyOf.length) {
          var prev = gensym("prev");
          node.anyOf.forEach(function(sch, i2) {
            if (i2 === 0) {
              validate("var %s = errors", prev);
            } else {
              validate("if (errors !== %s) {", prev)("errors = %s", prev);
            }
            visit(name, sch, false, false, schemaPath);
          });
          node.anyOf.forEach(function(sch, i2) {
            if (i2) validate("}");
          });
          validate("if (%s !== errors) {", prev);
          error("no schemas match");
          validate("}");
        }
        if (node.oneOf && node.oneOf.length) {
          var prev = gensym("prev");
          var passes = gensym("passes");
          validate("var %s = errors", prev)("var %s = 0", passes);
          node.oneOf.forEach(function(sch, i2) {
            visit(name, sch, false, false, schemaPath);
            validate("if (%s === errors) {", prev)("%s++", passes)("} else {")("errors = %s", prev)("}");
          });
          validate("if (%s !== 1) {", passes);
          error("no (or more than one) schemas match");
          validate("}");
        }
        if (node.multipleOf !== void 0) {
          if (type !== "number" && type !== "integer") validate("if (%s) {", types.number(name));
          validate("if (!isMultipleOf(%s, %d)) {", name, node.multipleOf);
          error("has a remainder");
          validate("}");
          if (type !== "number" && type !== "integer") validate("}");
        }
        if (node.maxProperties !== void 0) {
          if (type !== "object") validate("if (%s) {", types.object(name));
          validate("if (Object.keys(%s).length > %d) {", name, node.maxProperties);
          error("has more properties than allowed");
          validate("}");
          if (type !== "object") validate("}");
        }
        if (node.minProperties !== void 0) {
          if (type !== "object") validate("if (%s) {", types.object(name));
          validate("if (Object.keys(%s).length < %d) {", name, node.minProperties);
          error("has less properties than allowed");
          validate("}");
          if (type !== "object") validate("}");
        }
        if (node.maxItems !== void 0) {
          if (type !== "array") validate("if (%s) {", types.array(name));
          validate("if (%s.length > %d) {", name, node.maxItems);
          error("has more items than allowed");
          validate("}");
          if (type !== "array") validate("}");
        }
        if (node.minItems !== void 0) {
          if (type !== "array") validate("if (%s) {", types.array(name));
          validate("if (%s.length < %d) {", name, node.minItems);
          error("has less items than allowed");
          validate("}");
          if (type !== "array") validate("}");
        }
        if (node.maxLength !== void 0) {
          if (type !== "string") validate("if (%s) {", types.string(name));
          validate("if (%s.length > %d) {", name, node.maxLength);
          error("has longer length than allowed");
          validate("}");
          if (type !== "string") validate("}");
        }
        if (node.minLength !== void 0) {
          if (type !== "string") validate("if (%s) {", types.string(name));
          validate("if (%s.length < %d) {", name, node.minLength);
          error("has less length than allowed");
          validate("}");
          if (type !== "string") validate("}");
        }
        if (node.minimum !== void 0) {
          if (type !== "number" && type !== "integer") validate("if (%s) {", types.number(name));
          validate("if (%s %s %d) {", name, node.exclusiveMinimum ? "<=" : "<", node.minimum);
          error("is less than minimum");
          validate("}");
          if (type !== "number" && type !== "integer") validate("}");
        }
        if (node.maximum !== void 0) {
          if (type !== "number" && type !== "integer") validate("if (%s) {", types.number(name));
          validate("if (%s %s %d) {", name, node.exclusiveMaximum ? ">=" : ">", node.maximum);
          error("is more than maximum");
          validate("}");
          if (type !== "number" && type !== "integer") validate("}");
        }
        if (properties) {
          Object.keys(properties).forEach(function(p2) {
            if (Array.isArray(type) && type.indexOf("null") !== -1) validate("if (%s !== null) {", name);
            visit(
              genobj(name, p2),
              properties[p2],
              reporter2,
              filter,
              schemaPath.concat(tuple ? p2 : ["properties", p2])
            );
            if (Array.isArray(type) && type.indexOf("null") !== -1) validate("}");
          });
        }
        while (indent--) validate("}");
      };
      var validate = genfun("function validate(data) {")("if (data === undefined) data = null")("validate.errors = null")("var errors = 0");
      visit("data", schema, reporter, opts && opts.filter, []);
      validate("return errors === 0")("}");
      validate = validate.toFunction(scope);
      validate.errors = null;
      if (Object.defineProperty) {
        Object.defineProperty(validate, "error", {
          get: function() {
            if (!validate.errors) return "";
            return validate.errors.map(function(err) {
              return err.field + " " + err.message;
            }).join("\n");
          }
        });
      }
      validate.toJSON = function() {
        return schema;
      };
      return validate;
    };
    module.exports = function(schema, opts) {
      if (typeof schema === "string") schema = JSON.parse(schema);
      return compile(schema, {}, schema, true, opts);
    };
    module.exports.filter = function(schema, opts) {
      var validate = module.exports(schema, xtend(opts, { filter: true }));
      return function(sch) {
        validate(sch);
        return sch;
      };
    };
  }
});

// src/cli.mjs
import { homedir as homedir2 } from "node:os";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

// src/api.mjs
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

// src/common.mjs
import { createHash } from "node:crypto";
var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
var USDC_CONTRACT = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
var STORAGE_DEPOSIT = "1250000000000000000000";
var AgentError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AgentError";
    this.code = code;
  }
};
function fail(code, message) {
  throw new AgentError(code, message);
}
function decimal(value, label, max = (1n << 128n) - 1n) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) fail("invalid_amount", `Invalid ${label}`);
  if (!/^(0|[1-9]\d*)$/.test(String(value))) fail("invalid_amount", `Invalid ${label}`);
  const number = BigInt(value);
  if (number > max) fail("invalid_amount", `${label} exceeds supported range`);
  return number;
}
function canonicalJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail("invalid_spec", "Spec numbers must be safe integers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  fail("invalid_spec", "Unsupported spec value");
}
function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}
function parseSpec(value, expectedHash) {
  const spec = typeof value === "string" ? JSON.parse(value) : value;
  if (!spec || typeof spec !== "object" || Array.isArray(spec) || Object.keys(spec).sort().join(",") !== "amount_out,receiver,token_contract,v" || typeof spec.receiver !== "string" || !spec.receiver || typeof spec.token_contract !== "string" || !spec.token_contract || spec.v !== 1) fail("invalid_spec", "Invalid token-buy spec");
  decimal(spec.amount_out, "amount_out");
  const canonical = canonicalJson(spec);
  if (expectedHash && sha256Hex(canonical) !== expectedHash) fail("spec_mismatch", "API spec does not match chain spec_hash");
  return { spec, canonical };
}
function guardDeadline(order, marginSeconds, now = Date.now()) {
  const left = decimal(order.deadline_ns, "deadline_ns") - BigInt(now) * 1000000n;
  if (left <= BigInt(marginSeconds) * 1000000000n) {
    fail("deadline_too_close", "Order deadline is past or inside the safety margin");
  }
}

// src/api.mjs
var FulfilApi = class {
  constructor({
    baseUrl = "https://fulfil.junstudio.xyz",
    accountId,
    signer,
    fetchImpl = fetch,
    clock = Date.now,
    escrowContract = "nearfullfil.near",
    intentsContract = "intents.near",
    cacheDir = tmpdir()
  }) {
    const url = new URL(baseUrl);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
      fail("invalid_config", "FULFIL_API must be HTTPS or local HTTP");
    }
    this.baseUrl = url.origin;
    this.accountId = accountId;
    this.signer = signer;
    this.fetch = fetchImpl;
    this.clock = clock;
    this.escrowContract = escrowContract;
    this.intentsContract = intentsContract;
    this.cachePath = join(cacheDir, `fulfil-session-${sha256Hex(`${this.baseUrl}|${accountId}`)}.json`);
    this.cookie = "";
    this.expiresAt = 0;
  }
  async loadCookie() {
    try {
      const file = await stat(this.cachePath);
      if (!file.isFile() || (file.mode & 63) !== 0) return;
      const cached = JSON.parse(await readFile(this.cachePath, "utf8"));
      if (cached.expiresAt > this.clock() + 1e4 && /^fulfil_v3_session=[^;]+$/.test(cached.cookie)) {
        this.cookie = cached.cookie;
        this.expiresAt = cached.expiresAt;
      }
    } catch {
    }
  }
  async request(method, path, body, retried = false) {
    if (!/^\/[a-zA-Z0-9_/?=&.%-]+$/.test(path) || path.includes("..")) fail("invalid_path", "Invalid API path");
    const response = await this.fetch(`${this.baseUrl}/api/v3${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        ...this.cookie ? { Cookie: this.cookie } : {}
      },
      ...body === void 0 ? {} : { body: JSON.stringify(body) }
    });
    if (response.status === 401 && !retried && !path.startsWith("/auth/")) {
      if (!this.signer) fail("auth_required", "Session expired; signing key required for login");
      await this.login();
      return this.request(method, path, body, true);
    }
    if (!response.ok) {
      let code = `api_http_${response.status}`;
      let message = `Fulfil API returned HTTP ${response.status}`;
      try {
        const problem = await response.json();
        if (typeof problem?.error?.code === "string" && /^[a-zA-Z0-9_]{1,80}$/.test(problem.error.code)) {
          code = problem.error.code;
        }
        if (typeof problem?.error?.message === "string" && problem.error.message.length <= 500 && !/ed25519:|fulfil_v3_session=|private.key|secret.key/i.test(problem.error.message)) {
          message = problem.error.message;
        }
      } catch {
      }
      const error = new AgentError(code, message);
      error.http_status = response.status;
      throw error;
    }
    const setCookie = response.headers.get("set-cookie");
    if (setCookie?.startsWith("fulfil_v3_session=")) this.cookie = setCookie.split(";")[0];
    return response.json();
  }
  validateChallenge(challenge) {
    const expected = new URL(this.baseUrl);
    const match = challenge.message?.match(/^([^\n]+) wants you to sign in with your wallet:\nFulfil\n\nSign in to Fulfil\.\n\nURI: ([^\n]+)\nVersion: 1\nNonce: ([^\n]+)\nIssued At: ([^\n]+)\nExpiration Time: ([^\n]+)$/);
    const nonce = Buffer.from(challenge.nonce || "", "base64");
    let origin;
    try {
      origin = new URL(match?.[2]).origin;
    } catch {
      fail("unsafe_challenge", "Invalid Fulfil login URI");
    }
    const issued = Date.parse(match?.[4]);
    const expiry = Date.parse(challenge.expires_at);
    if (!match || match[1] !== expected.host || origin !== expected.origin || challenge.recipient !== expected.host || challenge.recipient === this.intentsContract || match[3] !== challenge.nonce || nonce.length !== 32 || nonce.toString("base64") !== challenge.nonce || Date.parse(match[5]) !== expiry || !Number.isFinite(issued) || !Number.isFinite(expiry) || issued < this.clock() - 36e4 || issued > this.clock() + 6e4 || expiry <= this.clock() || expiry - issued > 36e4 || expiry > this.clock() + 36e4) {
      fail("unsafe_challenge", "Unsafe Fulfil login challenge");
    }
  }
  async login() {
    if (!this.signer) fail("auth_required", "Signing key required for login");
    this.cookie = "";
    const challenge = await this.request("POST", "/auth/challenge", {});
    this.validateChallenge(challenge);
    const session = await this.request("POST", "/auth/verify", {
      standard: "nep413",
      account_id: this.accountId,
      public_key: this.signer.publicKey,
      signature: await this.signer.signNep413(challenge),
      message: challenge.message,
      nonce: challenge.nonce,
      recipient: challenge.recipient
    });
    const expiresAt = Date.parse(session.expires_at);
    if (!this.cookie || !Number.isFinite(expiresAt) || expiresAt <= this.clock()) fail("auth_failed", "Fulfil login did not issue a valid session");
    this.expiresAt = expiresAt;
    const temporary = `${this.cachePath}.${randomUUID()}`;
    await writeFile(temporary, JSON.stringify({ cookie: this.cookie, expiresAt }), { mode: 384, flag: "wx" });
    await rename(temporary, this.cachePath);
  }
  validateBuilt(built, expected) {
    const payload = built?.payload_to_sign;
    if (built?.standard !== void 0 && built.standard !== "nep413") fail("unsafe_intent", "Unsupported intent signing standard");
    if (!payload || typeof payload.message !== "string" || typeof payload.recipient !== "string") fail("unsafe_intent", "Invalid intent build");
    let data;
    try {
      data = JSON.parse(payload.message);
    } catch {
      fail("unsafe_intent", "Invalid intent message");
    }
    const deadline = Date.parse(data.deadline);
    const nonce = Buffer.from(payload.nonce || "", "base64");
    if (payload.recipient !== this.intentsContract || data.signer_id !== this.accountId || data.verifying_contract !== void 0 && data.verifying_contract !== this.intentsContract || !Number.isFinite(deadline) || deadline <= this.clock() || deadline > this.clock() + 36e4 || nonce.length !== 32 || nonce.toString("base64") !== payload.nonce || !Array.isArray(data.intents) || data.intents.length !== 1) fail("unsafe_intent", "Unsafe intent build");
    const intent = data.intents[0];
    let message;
    try {
      message = JSON.parse(intent.msg);
    } catch {
      fail("unsafe_intent", "Invalid auth_call message");
    }
    const expectedMessage = expected.op === "register_fulfiller" ? { op: expected.op } : { op: expected.op, order_id: expected.order_id };
    if (expected.op === "submit_proof") {
      expectedMessage.proof_sha256 = expected.proof_sha256;
      expectedMessage.spec = expected.spec;
    }
    const exact = (actual, target) => actual && typeof actual === "object" && Object.keys(actual).length === Object.keys(target).length && Object.keys(target).every((key) => actual[key] === target[key]);
    if (!exact(message, expectedMessage) || !exact(intent, {
      intent: "auth_call",
      contract_id: this.escrowContract,
      msg: intent.msg,
      attached_deposit: "0",
      min_gas: expected.op === "submit_proof" ? "200000000000000" : "20000000000000"
    })) fail("unsafe_intent", "Intent build differs from requested operation");
    return payload;
  }
  async authCall(op, orderId, extras = {}) {
    if (!["register_fulfiller", "claim", "release_claim", "submit_proof"].includes(op)) fail("unsupported_intent", "Unsupported auth_call");
    const { spec, ...buildExtras } = extras;
    const request = op === "register_fulfiller" ? { kind: "auth_call", op } : { kind: "auth_call", op, order_id: orderId, ...buildExtras };
    const built = await this.request("POST", "/intents/build", request);
    const payload = this.validateBuilt(built, { ...request, spec });
    if (!this.signer) fail("auth_required", "Signing key required for intent submission");
    return this.request("POST", "/intents/submit", {
      standard: "nep413",
      payload,
      public_key: this.signer.publicKey,
      signature: await this.signer.signNep413(payload)
    });
  }
};

// src/intear.mjs
var TOKEN_IN = `nep141:${USDC_CONTRACT}`;
function quoteProfit(order, quote, minProfit = "0") {
  const pay = decimal(order.pay_amount, "pay_amount");
  const reward = decimal(order.reward, "reward");
  const fee = decimal(quote.fee_amount ?? "0", "fee_amount");
  const input = decimal(quote.worst_case_amount?.amount_in, "worst_case_amount.amount_in") + fee;
  const estimated = decimal(quote.estimated_amount?.amount_in, "estimated_amount.amount_in") + fee;
  const profit = pay + reward - input;
  return {
    usdc_in: input.toString(),
    estimated_usdc_in: estimated.toString(),
    income_usdc: (pay + reward).toString(),
    profit_usdc: profit.toString(),
    profitable: profit >= decimal(minProfit, "FULFIL_MIN_PROFIT_USDC"),
    near_costs: {
      route_storage_deposits: String(quote.storage_deposits ?? "0"),
      route_estimated_gas: String(quote.estimated_gas_usage ?? "0"),
      receiver_storage_if_unregistered: "1250000000000000000000",
      delivery_gas: "30000000000000 gas units estimated"
    }
  };
}
var IntearRouter = class {
  constructor({ fetchImpl = fetch, baseUrl = "https://router.intear.tech", slippage = "0.03" } = {}) {
    if (!/^(0|1)(\.\d{1,6})?$/.test(slippage)) fail("invalid_config", "Invalid FULFIL_SLIPPAGE");
    const [whole, fraction = ""] = slippage.split(".");
    const millionths = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0") || "0");
    if (millionths > 100000n) fail("invalid_config", "FULFIL_SLIPPAGE exceeds 10%");
    this.fetch = fetchImpl;
    this.baseUrl = baseUrl;
    this.slippage = slippage;
  }
  async get(path, params) {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await this.fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) fail("router_http", `Intear router returned HTTP ${response.status}`);
    return response.json();
  }
  async quote(spec, accountId) {
    const tokenOut = `nep141:${spec.token_contract}`;
    const quotes = await this.get("/route", {
      token_in: TOKEN_IN,
      token_out: tokenOut,
      amount_out: spec.amount_out,
      slippage_type: "Fixed",
      slippage: this.slippage,
      trader_account_id: accountId
    });
    if (!Array.isArray(quotes)) fail("invalid_route", "Intear route response is not an array");
    const valid = quotes.filter((quote) => quote?.token_output === tokenOut && quote.worst_case_amount?.amount_in !== void 0 && Array.isArray(quote.execution_instructions));
    if (!valid.length) fail("no_route", "No deliverable exact-output route");
    valid.sort((a, b) => {
      const x = decimal(a.worst_case_amount.amount_in, "route amount");
      const y = decimal(b.worst_case_amount.amount_in, "route amount");
      return x < y ? -1 : x > y ? 1 : 0;
    });
    return valid[0];
  }
  async outcome(spec, accountId, txHashes, feeAmount = "0") {
    return this.get("/route/outcome", {
      token_in: TOKEN_IN,
      token_out: `nep141:${spec.token_contract}`,
      trader_account_id: accountId,
      tx_hashes: txHashes.join(","),
      fee_amount: feeAmount
    });
  }
};
function parseInstructions(instructions) {
  if (!Array.isArray(instructions) || !instructions.length) fail("invalid_route", "Route has no instructions");
  return instructions.map((instruction) => {
    if (!instruction || Object.keys(instruction).join() !== "NearTransaction") fail("unsupported_instruction", "Unsupported route instruction");
    const tx = instruction.NearTransaction;
    if (!tx || typeof tx.receiver_id !== "string" || !Array.isArray(tx.actions) || !tx.actions.length) {
      fail("invalid_route", "Invalid NearTransaction instruction");
    }
    const actions4 = tx.actions.map((action) => {
      if (action?.FunctionCall && Object.keys(action).join() === "FunctionCall") {
        const call = action.FunctionCall;
        if (typeof call.method_name !== "string" || typeof call.args !== "string") fail("invalid_route", "Invalid FunctionCall");
        const args = Buffer.from(call.args, "base64");
        if (args.toString("base64") !== call.args) fail("invalid_route", "Invalid base64 arguments");
        return {
          type: "FunctionCall",
          methodName: call.method_name,
          args,
          gas: decimal(call.gas, "gas", (1n << 64n) - 1n),
          deposit: decimal(call.deposit, "deposit")
        };
      }
      if (action?.Transfer && Object.keys(action).join() === "Transfer") {
        return { type: "Transfer", deposit: decimal(action.Transfer.deposit, "deposit") };
      }
      fail("unsupported_action", "Unsupported route action");
    });
    return { receiverId: tx.receiver_id, actions: actions4, isFee: tx.is_fee_transaction === true };
  });
}

// src/commands.mjs
var GAS_STORAGE = "30000000000000";
var GAS_TRANSFER = "30000000000000";
var INTENTS_CONTRACT = "intents.near";
var GAS_WITHDRAW = "50000000000000";
function requiredFloat(usdcIn) {
  const input = decimal(usdcIn, "route USDC input");
  const margin = (input + 99n) / 100n;
  return input + (margin > 1000n ? margin : 1000n);
}
function profileRegistered(value) {
  return value !== null && value?.profile !== null && value?.profile !== void 0;
}
async function isStorageRegistered(rpc, contract, accountId) {
  let balance;
  try {
    balance = await rpc.view(contract, "storage_balance_of", { account_id: accountId });
  } catch (error) {
    fail("storage_check_failed", `Could not check storage registration for ${accountId} on ${contract}: ${error.message}`);
  }
  if (balance === null) return false;
  if (!balance || typeof balance.total !== "string" || !/^\d+$/.test(balance.total)) {
    fail("storage_check_failed", `Invalid storage balance for ${accountId} on ${contract}`);
  }
  return BigInt(balance.total) !== 0n;
}
function buildDeliverActions(receiver, amount, storageDeposit = null, memo = "Fulfil token delivery") {
  if (typeof receiver !== "string" || !receiver) fail("invalid_receiver", "Invalid receiver");
  const units = decimal(amount, "delivery amount");
  if (units === 0n) fail("invalid_amount", "Delivery amount must be positive");
  const actions4 = [];
  if (storageDeposit !== null) {
    actions4.push({
      type: "FunctionCall",
      methodName: "storage_deposit",
      args: Buffer.from(JSON.stringify({ account_id: receiver, registration_only: true })),
      gas: GAS_STORAGE,
      deposit: decimal(storageDeposit, "storage deposit").toString()
    });
  }
  actions4.push({
    type: "FunctionCall",
    methodName: "ft_transfer",
    args: Buffer.from(JSON.stringify({ receiver_id: receiver, amount: units.toString(), memo })),
    gas: GAS_TRANSFER,
    deposit: "1"
  });
  return actions4;
}
var Commands = class {
  constructor({
    accountId,
    signer,
    api,
    rpc,
    router,
    escrowContract = "nearfullfil.near",
    minProfit = "0",
    deadlineMarginSeconds = 120,
    clock = Date.now,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  }) {
    this.accountId = accountId;
    this.signer = signer;
    this.api = api;
    this.rpc = rpc;
    this.router = router;
    this.escrowContract = escrowContract;
    this.minProfit = minProfit;
    this.deadlineMarginSeconds = deadlineMarginSeconds;
    this.clock = clock;
    this.sleep = sleep;
  }
  async readOrderForPolling(id2) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.getOrder(id2, null, false);
      } catch (error) {
        if (error.code !== "order_mismatch" || attempt === 2) throw error;
        await this.sleep(3e3);
      }
    }
  }
  async refreshSubmittedOrder(id2, result, operation) {
    if (!result || result.status !== "success") return result;
    const original = result.order;
    let chain2;
    for (let attempt = 0; attempt < 3; attempt++) {
      chain2 = void 0;
      try {
        chain2 = await this.rpc.view(this.escrowContract, "get_order", { id: id2 });
      } catch {
      }
      const advanced = operation === "claim" ? chain2?.status === "claimed" && chain2.fulfiller === this.accountId : chain2 && chain2.status !== "claimed" && chain2.status !== "proof_rejected";
      if (advanced) {
        if (operation === "prove" && original?.status === "paid" && chain2.status !== "paid") {
          return result;
        }
        return { ...result, order: { ...original, ...chain2 } };
      }
      if (operation === "prove" && original?.status !== "claimed" && original?.status !== "proof_rejected" && original?.status !== void 0) {
        return result;
      }
      if (attempt < 2) await this.sleep(3e3);
    }
    if (operation === "prove" && chain2?.status === "proof_rejected") {
      return { ...result, order: { ...original, ...chain2 } };
    }
    const { order: _staleOrder, ...rest } = result;
    return { ...rest, order_refresh: "pending" };
  }
  async filterStorageActions(instruction) {
    const actions4 = [];
    for (const action of instruction.actions) {
      if (action.methodName !== "storage_deposit") {
        actions4.push(action);
        continue;
      }
      let args;
      try {
        args = JSON.parse(action.args.toString("utf8"));
      } catch {
        fail("invalid_route", "Invalid storage_deposit arguments");
      }
      if (!args || typeof args !== "object" || Array.isArray(args) || args.account_id !== void 0 && (typeof args.account_id !== "string" || !args.account_id)) {
        fail("invalid_route", "Invalid storage_deposit account_id");
      }
      const accountId = args.account_id ?? this.accountId;
      if (!await isStorageRegistered(this.rpc, instruction.receiverId, accountId)) actions4.push(action);
    }
    return { ...instruction, actions: actions4 };
  }
  async setupStatus() {
    const intentsKey = await this.rpc.view(INTENTS_CONTRACT, "has_public_key", {
      account_id: this.accountId,
      public_key: this.signer.publicKey
    });
    if (typeof intentsKey !== "boolean") fail("invalid_setup", "Invalid intents.near key response");
    const profile = await this.rpc.view(this.escrowContract, "get_profile", { account_id: this.accountId });
    return { intentsKey, profileRegistered: profileRegistered(profile) };
  }
  async requireSetup() {
    const status = await this.setupStatus();
    const missing = [];
    if (!status.intentsKey) missing.push("intents.near public key");
    if (!status.profileRegistered) missing.push("fulfiller profile");
    if (missing.length) {
      fail("setup_required", `Missing ${missing.join(" and ")}; run node fulfil-agent.mjs setup`);
    }
  }
  async setup(dryRun = false) {
    const current = await this.setupStatus();
    const intents_key = { registered: current.intentsKey, action: current.intentsKey ? "none" : dryRun ? "would_add" : "added" };
    const fulfiller_profile = {
      registered: current.profileRegistered,
      action: current.profileRegistered ? "none" : dryRun ? "would_register" : "registered"
    };
    if (!dryRun && !current.intentsKey) {
      const sent = await this.rpc.sendActions({
        accountId: this.accountId,
        signer: this.signer,
        receiverId: INTENTS_CONTRACT,
        actions: [{
          type: "FunctionCall",
          methodName: "add_public_key",
          args: Buffer.from(JSON.stringify({ public_key: this.signer.publicKey })),
          gas: "30000000000000",
          deposit: "1"
        }]
      });
      intents_key.registered = true;
      intents_key.tx_hash = sent.tx_hash;
    }
    if (!dryRun && !current.profileRegistered) {
      const result = await this.api.authCall("register_fulfiller");
      fulfiller_profile.registered = true;
      if (result?.tx_hash) fulfiller_profile.tx_hash = result.tx_hash;
      if (result?.status) fulfiller_profile.status = result.status;
    }
    return { account_id: this.accountId, intents_key, fulfiller_profile };
  }
  async getOrder(id2, listCandidate = null, requireSpec = true) {
    if (typeof id2 !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id2)) fail("invalid_order_id", "Invalid order ID");
    const chain2 = await this.rpc.view(this.escrowContract, "get_order", { id: id2 });
    if (!chain2 || chain2.id !== id2 || chain2.kind !== "token_buy") fail("order_missing", "Token-buy order not found on chain");
    const detail = await this.api.request("GET", `/orders/${id2}`);
    const order = detail.order;
    if (!order || order.id !== id2 || order.kind !== chain2.kind || order.status !== chain2.status || order.spec_hash !== chain2.spec_hash || order.fulfiller !== chain2.fulfiller || order.deadline_ns !== chain2.deadline_ns || order.buyer !== chain2.buyer || order.pay_amount !== chain2.pay_amount || order.reward !== chain2.reward) fail("order_mismatch", "API order differs from chain order");
    let specValue = order.spec ?? listCandidate?.spec;
    if (requireSpec && specValue === void 0) {
      let from;
      for (let page = 0; page < 10 && specValue === void 0; page++) {
        const params = new URLSearchParams({ kind: "token_buy", status: chain2.status, limit: "100" });
        if (from) params.set("from", from);
        const list = await this.api.request("GET", `/orders?${params}`);
        if (!Array.isArray(list.orders)) fail("invalid_orders", "API order list is invalid");
        specValue = list.orders.find((item) => item.id === id2)?.spec;
        if (!list.next_from || list.next_from === from) break;
        from = list.next_from;
      }
    }
    const { spec, canonical } = requireSpec ? parseSpec(specValue, chain2.spec_hash) : { spec: null, canonical: null };
    return { chain: chain2, order, spec, canonical };
  }
  async orders() {
    const list = await this.api.request("GET", "/orders?status=funded&kind=token_buy");
    if (!Array.isArray(list.orders)) fail("invalid_orders", "API order list is invalid");
    const orders = [];
    for (const candidate of list.orders) {
      try {
        const { chain: chain2, order, spec } = await this.getOrder(candidate.id, candidate);
        if (chain2.status !== "funded") continue;
        const own_order = chain2.buyer === this.accountId;
        let deadlineSafe = true;
        try {
          guardDeadline(chain2, this.deadlineMarginSeconds, this.clock());
        } catch {
          deadlineSafe = false;
        }
        let estimate = null;
        if (!own_order) {
          try {
            const route = await this.router.quote(spec, this.accountId);
            estimate = { dex_id: route.dex_id, ...quoteProfit(chain2, route, this.minProfit) };
          } catch (error) {
            estimate = { error: error.code || "quote_failed" };
          }
        }
        orders.push({
          id: chain2.id,
          buy_token: order.buy_token || candidate.buy_token || null,
          delivery_tx_hash: order.delivery_tx_hash || candidate.delivery_tx_hash || null,
          spec,
          pay_amount: chain2.pay_amount,
          reward: chain2.reward,
          deadline_ns: chain2.deadline_ns,
          own_order,
          claimable: !own_order && deadlineSafe,
          estimate
        });
      } catch (error) {
        orders.push({ id: candidate.id, error: error.code || "order_unavailable" });
      }
    }
    return { orders, next_from: list.next_from || null };
  }
  async quote(id2) {
    const { chain: chain2, spec } = await this.getOrder(id2);
    if (chain2.status !== "funded" && chain2.status !== "claimed") fail("wrong_status", "Order is not available for a quote");
    const route = await this.router.quote(spec, this.accountId);
    return {
      order_id: id2,
      token_contract: spec.token_contract,
      amount_out: spec.amount_out,
      dex_id: route.dex_id,
      ...quoteProfit(chain2, route, this.minProfit),
      route
    };
  }
  async claim(id2) {
    const { chain: chain2 } = await this.getOrder(id2, null, false);
    if (chain2.buyer === this.accountId) fail("own_order", "Cannot claim your own order");
    if (chain2.status !== "funded") fail("wrong_status", "Order is not funded on chain");
    guardDeadline(chain2, this.deadlineMarginSeconds, this.clock());
    await this.requireSetup();
    const profile = await this.rpc.view(this.escrowContract, "get_profile", { account_id: this.accountId });
    if (Number(profile?.stats?.active_claims ?? 0) > 0) {
      fail("active_claim", "Release the existing claim before claiming another order");
    }
    const result = await this.refreshSubmittedOrder(id2, await this.api.authCall("claim", id2), "claim");
    return { order_id: id2, operation: "claim", result };
  }
  async ownedClaim(id2, allowedStatuses = ["claimed"]) {
    const details = await this.getOrder(id2);
    if (details.chain.buyer === this.accountId) fail("own_order", "Cannot fulfil your own order");
    if (!allowedStatuses.includes(details.chain.status) || details.chain.fulfiller !== this.accountId) {
      fail("not_claimed", "Order is not claimed by this account");
    }
    guardDeadline(details.chain, this.deadlineMarginSeconds, this.clock());
    return details;
  }
  async tokenBalance(spec) {
    const balance = await this.rpc.tokenBalance(spec.token_contract, this.accountId);
    return decimal(balance, "token balance");
  }
  async usdcBalances() {
    const [wallet, intents] = await Promise.all([
      this.rpc.tokenBalance(USDC_CONTRACT, this.accountId),
      this.rpc.view(INTENTS_CONTRACT, "mt_balance_of", {
        account_id: this.accountId,
        token_id: `nep141:${USDC_CONTRACT}`
      })
    ]);
    return { wallet: decimal(wallet, "wallet USDC"), intents: decimal(intents, "intents USDC") };
  }
  async balances() {
    const [{ wallet, intents }, account] = await Promise.all([
      this.usdcBalances(),
      this.rpc.viewAccount(this.accountId)
    ]);
    return {
      wallet_usdc: wallet.toString(),
      intents_usdc: intents.toString(),
      near: decimal(account?.amount, "NEAR account amount").toString(),
      account_id: this.accountId
    };
  }
  async withdrawToWallet(amount = null, dryRun = false) {
    const { wallet, intents } = await this.usdcBalances();
    const units = amount === null ? intents : decimal(amount, "withdraw amount");
    if (units > intents) fail("insufficient_intents_balance", `Requested ${units} USDC base units; intents balance is ${intents}`);
    if (units === 0n) fail("nothing_to_withdraw", "Intents USDC balance is zero");
    const registered = await isStorageRegistered(this.rpc, USDC_CONTRACT, this.accountId);
    if (dryRun) {
      return {
        withdrawn: units.toString(),
        storage_registration_needed: !registered,
        wallet_usdc_before: wallet.toString(),
        wallet_usdc_after: null,
        intents_usdc_before: intents.toString(),
        intents_usdc_after: null
      };
    }
    let storage_tx_hash;
    if (!registered) {
      const sent2 = await this.rpc.sendActions({
        accountId: this.accountId,
        signer: this.signer,
        receiverId: USDC_CONTRACT,
        actions: [{
          type: "FunctionCall",
          methodName: "storage_deposit",
          args: Buffer.from(JSON.stringify({ account_id: this.accountId, registration_only: true })),
          gas: GAS_STORAGE,
          deposit: STORAGE_DEPOSIT
        }]
      });
      storage_tx_hash = sent2.tx_hash;
    }
    const sent = await this.rpc.sendActions({
      accountId: this.accountId,
      signer: this.signer,
      receiverId: INTENTS_CONTRACT,
      actions: [{
        type: "FunctionCall",
        methodName: "ft_withdraw",
        args: Buffer.from(JSON.stringify({ token: USDC_CONTRACT, receiver_id: this.accountId, amount: units.toString() })),
        gas: GAS_WITHDRAW,
        deposit: "1"
      }]
    });
    const after = await this.usdcBalances();
    return {
      withdrawn: units.toString(),
      tx_hash: sent.tx_hash,
      ...storage_tx_hash ? { storage_tx_hash } : {},
      wallet_usdc_before: wallet.toString(),
      wallet_usdc_after: after.wallet.toString(),
      intents_usdc_before: intents.toString(),
      intents_usdc_after: after.intents.toString()
    };
  }
  async ensureFloat(usdcIn, dryRun = false) {
    const required = requiredFloat(usdcIn);
    const { wallet, intents } = await this.usdcBalances();
    const enough = wallet >= required;
    const canTopUp = wallet + intents >= required;
    const float = {
      wallet_usdc: wallet.toString(),
      intents_usdc: intents.toString(),
      required_usdc: required.toString(),
      sufficient: enough || canTopUp,
      needs_withdraw: !enough && canTopUp
    };
    if (dryRun) return { float };
    if (!canTopUp) fail("insufficient_float", `Wallet ${wallet}, intents ${intents}, required ${required} USDC base units`);
    return { float, ...enough ? {} : { auto_withdraw: await this.withdrawToWallet() } };
  }
  async buy(id2) {
    const { chain: chain2, spec } = await this.ownedClaim(id2);
    const route = await this.router.quote(spec, this.accountId);
    const profit = quoteProfit(chain2, route, this.minProfit);
    if (!profit.profitable) {
      fail("unprofitable_route", "Fresh route is below minimum USDC profit");
    }
    const instructions = parseInstructions(route.execution_instructions);
    const txHashes = [];
    let sawFee = false;
    for (const instruction of instructions) {
      if (instruction.isFee) sawFee = true;
      if (sawFee && !instruction.isFee) fail("invalid_route", "Fee transactions must be last");
    }
    const checkedInstructions = [];
    for (const instruction of instructions) checkedInstructions.push(await this.filterStorageActions(instruction));
    const { auto_withdraw } = await this.ensureFloat(profit.usdc_in);
    for (const instruction of checkedInstructions.filter((item) => !item.isFee && item.actions.length)) {
      const sent = await this.rpc.sendActions({
        accountId: this.accountId,
        signer: this.signer,
        receiverId: instruction.receiverId,
        actions: instruction.actions
      });
      txHashes.push(sent.tx_hash);
    }
    let outcome = null;
    try {
      outcome = await this.router.outcome(spec, this.accountId, txHashes, route.fee_amount || "0");
    } catch (error) {
      if (!["router_http", "network_error"].includes(error.code) && !(error instanceof TypeError)) throw error;
    }
    if (outcome) {
      const swapFailed = Boolean(outcome.error || outcome.charge_fee === false);
      if (!outcome.settled && !swapFailed) fail("swap_unsettled", "Swap outcome is not settled");
      if (outcome.charge_fee && !swapFailed) {
        for (const step of checkedInstructions.filter((item) => item.isFee && item.actions.length)) {
          const sent = await this.rpc.sendActions({
            accountId: this.accountId,
            signer: this.signer,
            receiverId: step.receiverId,
            actions: step.actions
          });
          txHashes.push(sent.tx_hash);
        }
      }
      let recoveryFailed = false;
      const recoveryAttempted = Array.isArray(outcome.next_steps) && outcome.next_steps.length > 0;
      if (recoveryAttempted) {
        try {
          for (const instruction of parseInstructions(outcome.next_steps)) {
            const step = await this.filterStorageActions(instruction);
            if (!step.actions.length) continue;
            const sent = await this.rpc.sendActions({
              accountId: this.accountId,
              signer: this.signer,
              receiverId: step.receiverId,
              actions: step.actions
            });
            txHashes.push(sent.tx_hash);
          }
        } catch (error) {
          if (!swapFailed) throw error;
          recoveryFailed = true;
        }
      }
      if (swapFailed) {
        fail("swap_failed", recoveryFailed ? "Intear reported a failed swap and a recovery step failed" : recoveryAttempted ? "Intear reported a failed swap; recovery steps were attempted" : "Intear reported a failed swap");
      }
    }
    const balance = await this.tokenBalance(spec);
    if (balance < BigInt(spec.amount_out)) fail("insufficient_tokens", "Token balance is below required delivery amount");
    return {
      order_id: id2,
      tx_hashes: txHashes,
      balance: balance.toString(),
      ...auto_withdraw ? { auto_withdraw } : {},
      outcome: outcome ? { amount_in: outcome.amount_in, amount_out: outcome.amount_out, settled: outcome.settled } : null
    };
  }
  async deliver(id2, amount) {
    const { spec } = await this.ownedClaim(id2);
    const units = decimal(amount ?? spec.amount_out, "delivery amount");
    if (units < BigInt(spec.amount_out)) fail("insufficient_amount", "Delivery amount is below the order minimum");
    const balance = await this.tokenBalance(spec);
    if (balance < units) fail("insufficient_tokens", "Token balance is below delivery amount");
    const registered = await isStorageRegistered(this.rpc, spec.token_contract, spec.receiver);
    let deposit = null;
    if (!registered) {
      try {
        const bounds = await this.rpc.view(spec.token_contract, "storage_balance_bounds", {});
        deposit = decimal(bounds.min, "storage minimum").toString();
      } catch {
        deposit = STORAGE_DEPOSIT;
      }
    }
    const actions4 = buildDeliverActions(spec.receiver, units.toString(), deposit);
    const sent = await this.rpc.sendActions({
      accountId: this.accountId,
      signer: this.signer,
      receiverId: spec.token_contract,
      actions: actions4
    });
    return {
      order_id: id2,
      tx_hash: sent.tx_hash,
      receiver: spec.receiver,
      amount: units.toString(),
      storage_deposit: deposit || "0"
    };
  }
  async prove(id2, txHash) {
    const { canonical } = await this.ownedClaim(id2, ["claimed", "proof_rejected"]);
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(txHash)) fail("invalid_tx_hash", "Invalid NEAR transaction hash");
    const uploaded = await this.api.request("POST", "/proofs", { order_id: id2, tx_hash: txHash });
    if (!/^[a-f0-9]{64}$/.test(uploaded.sha256 || "")) fail("invalid_proof", "Proof upload did not return SHA-256");
    const submitted = await this.refreshSubmittedOrder(
      id2,
      await this.api.authCall("submit_proof", id2, { proof_sha256: uploaded.sha256, spec: canonical }),
      "prove"
    );
    return { order_id: id2, proof_sha256: uploaded.sha256, result: submitted };
  }
  async status(id2) {
    const { chain: chain2, order } = await this.readOrderForPolling(id2);
    return {
      order_id: id2,
      status: chain2.status,
      fulfiller: chain2.fulfiller,
      deadline_ns: chain2.deadline_ns,
      api_status: order.status,
      delivery_tx_hash: order.delivery_tx_hash || null
    };
  }
  async release(id2) {
    const { chain: chain2 } = await this.getOrder(id2, null, false);
    if (chain2.status !== "claimed" || chain2.fulfiller !== this.accountId) fail("not_claimed", "No claim owned by this account");
    const result = await this.api.authCall("release_claim", id2);
    return { order_id: id2, operation: "release_claim", result };
  }
  async run(dryRun = false) {
    await this.requireSetup();
    const discovered = await this.orders();
    const choices = discovered.orders.filter((order) => !order.own_order && order.claimable && order.estimate?.profitable);
    choices.sort((a, b) => {
      const x = BigInt(a.estimate.profit_usdc);
      const y = BigInt(b.estimate.profit_usdc);
      return x > y ? -1 : x < y ? 1 : 0;
    });
    if (!choices.length) return { action: "none", reason: "No profitable non-own funded order" };
    const id2 = choices[0].id;
    const selected = await this.quote(id2);
    if (!selected.profitable) return { action: "none", reason: "Fresh quote is not profitable" };
    const floatCheck = await this.ensureFloat(selected.usdc_in, dryRun);
    if (dryRun) return {
      action: "dry_run",
      order_id: id2,
      quote: selected,
      float: floatCheck.float,
      steps: ["claim", "buy", "deliver", "prove", "status"]
    };
    let delivered = false;
    try {
      const claim = await this.claim(id2);
      const buy = await this.buy(id2);
      const delivery = await this.deliver(id2);
      delivered = true;
      const proof = await this.prove(id2, delivery.tx_hash);
      const status = await this.status(id2);
      return {
        action: "completed",
        order_id: id2,
        claim,
        buy,
        delivery,
        proof,
        status,
        ...floatCheck.auto_withdraw ? { auto_withdraw: floatCheck.auto_withdraw } : {}
      };
    } catch (error) {
      if (!delivered) {
        try {
          const chain2 = await this.rpc.view(this.escrowContract, "get_order", { id: id2 });
          if (chain2?.status === "claimed" && chain2.fulfiller === this.accountId) await this.api.authCall("release_claim", id2);
        } catch {
        }
      }
      if (error instanceof AgentError) throw error;
      fail(error.code || "run_failed", `Order ${id2} failed; check status and release the claim if still owned`);
    }
  }
};

// src/keys.mjs
import { readFile as readFile2 } from "node:fs/promises";
import { homedir } from "node:os";
import { join as join3 } from "node:path";

// node_modules/.pnpm/@noble+hashes@2.2.0/node_modules/@noble/hashes/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
function anumber(n, title = "") {
  if (typeof n !== "number") {
    const prefix = title && `"${title}" `;
    throw new TypeError(`${prefix}expected number, got ${typeof n}`);
  }
  if (!Number.isSafeInteger(n) || n < 0) {
    const prefix = title && `"${title}" `;
    throw new RangeError(`${prefix}expected integer >= 0, got ${n}`);
  }
}
function abytes(value, length, title = "") {
  const bytes = isBytes(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    const message = prefix + "expected Uint8Array" + ofLen + ", got " + got;
    if (!bytes)
      throw new TypeError(message);
    throw new RangeError(message);
  }
  return value;
}
function ahash(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new TypeError("Hash must wrapped by utils.createHasher");
  anumber(h.outputLen);
  anumber(h.blockLen);
  if (h.outputLen < 1)
    throw new Error('"outputLen" must be >= 1');
  if (h.blockLen < 1)
    throw new Error('"blockLen" must be >= 1');
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes(out, void 0, "digestInto() output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new RangeError('"digestInto() output" expected to be of length >=' + min);
  }
}
function u32(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
var isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
function byteSwap(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
  return arr;
}
var swap32IfBE = isLE ? (u) => u : byteSwap32;
var hasHexBuiltin = /* @__PURE__ */ (() => (
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
))();
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes) {
  abytes(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
var asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
  if (ch >= asciis._0 && ch <= asciis._9)
    return ch - asciis._0;
  if (ch >= asciis.A && ch <= asciis.F)
    return ch - (asciis.A - 10);
  if (ch >= asciis.a && ch <= asciis.f)
    return ch - (asciis.a - 10);
  return;
}
function hexToBytes(hex) {
  if (typeof hex !== "string")
    throw new TypeError("hex string expected, got " + typeof hex);
  if (hasHexBuiltin) {
    try {
      return Uint8Array.fromHex(hex);
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new RangeError(error.message);
      throw error;
    }
  }
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new RangeError("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0) {
      const char = hex[hi] + hex[hi + 1];
      throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function concatBytes(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
function createHasher(hashCons, info = {}) {
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.canXOF = tmp.canXOF;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
function randomBytes(bytesLength = 32) {
  anumber(bytesLength, "bytesLength");
  const cr = typeof globalThis === "object" ? globalThis.crypto : null;
  if (typeof cr?.getRandomValues !== "function")
    throw new Error("crypto.getRandomValues must be defined");
  if (bytesLength > 65536)
    throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
  return cr.getRandomValues(new Uint8Array(bytesLength));
}
var oidNist = (suffix) => ({
  // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
  // Larger suffix values would need base-128 OID encoding and a different length byte.
  oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
});

// node_modules/.pnpm/@noble+hashes@2.2.0/node_modules/@noble/hashes/_md.js
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD = class {
  blockLen;
  outputLen;
  canXOF = false;
  padOffset;
  isLE;
  // For partial updates less than block size
  buffer;
  view;
  finished = false;
  length = 0;
  pos = 0;
  destroyed = false;
  constructor(blockLen, outputLen, padOffset, isLE2) {
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE2;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE: isLE2 } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    view.setBigUint64(blockLen - 8, BigInt(this.length * 8), isLE2);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen must be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE2);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to ||= new this.constructor();
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
var SHA512_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  4089235720,
  3144134277,
  2227873595,
  1013904242,
  4271175723,
  2773480762,
  1595750129,
  1359893119,
  2917565137,
  2600822924,
  725511199,
  528734635,
  4215389547,
  1541459225,
  327033209
]);

// node_modules/.pnpm/@noble+hashes@2.2.0/node_modules/@noble/hashes/_u64.js
var U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
var _32n = /* @__PURE__ */ BigInt(32);
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var shrSH = (h, _l, s) => h >>> s;
var shrSL = (h, l, s) => h << 32 - s | l >>> s;
var rotrSH = (h, l, s) => h >>> s | l << 32 - s;
var rotrSL = (h, l, s) => h << 32 - s | l >>> s;
var rotrBH = (h, l, s) => h << 64 - s | l >>> s - 32;
var rotrBL = (h, l, s) => h >>> s - 32 | l << 64 - s;
var rotlSH = (h, l, s) => h << s | l >>> 32 - s;
var rotlSL = (h, l, s) => l << s | h >>> 32 - s;
var rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
var rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;
function add(Ah, Al, Bh, Bl) {
  const l = (Al >>> 0) + (Bl >>> 0);
  return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
}
var add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
var add3H = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
var add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
var add4H = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
var add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
var add5H = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;

// node_modules/.pnpm/@noble+hashes@2.2.0/node_modules/@noble/hashes/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA2_32B = class extends HashMD {
  constructor(outputLen) {
    super(64, outputLen, 8, false);
  }
  get() {
    const { A, B, C, D: D3, E, F: F2, G, H } = this;
    return [A, B, C, D3, E, F2, G, H];
  }
  // prettier-ignore
  set(A, B, C, D3, E, F2, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D3 | 0;
    this.E = E | 0;
    this.F = F2 | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D: D3, E, F: F2, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F2, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F2;
      F2 = E;
      E = D3 + T1 | 0;
      D3 = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D3 = D3 + this.D | 0;
    E = E + this.E | 0;
    F2 = F2 + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D3, E, F2, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.destroyed = true;
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
var _SHA256 = class extends SHA2_32B {
  // We cannot use array here since array allows indexing by variable
  // which means optimizer/compiler cannot use registers.
  A = SHA256_IV[0] | 0;
  B = SHA256_IV[1] | 0;
  C = SHA256_IV[2] | 0;
  D = SHA256_IV[3] | 0;
  E = SHA256_IV[4] | 0;
  F = SHA256_IV[5] | 0;
  G = SHA256_IV[6] | 0;
  H = SHA256_IV[7] | 0;
  constructor() {
    super(32);
  }
};
var K512 = /* @__PURE__ */ (() => split([
  "0x428a2f98d728ae22",
  "0x7137449123ef65cd",
  "0xb5c0fbcfec4d3b2f",
  "0xe9b5dba58189dbbc",
  "0x3956c25bf348b538",
  "0x59f111f1b605d019",
  "0x923f82a4af194f9b",
  "0xab1c5ed5da6d8118",
  "0xd807aa98a3030242",
  "0x12835b0145706fbe",
  "0x243185be4ee4b28c",
  "0x550c7dc3d5ffb4e2",
  "0x72be5d74f27b896f",
  "0x80deb1fe3b1696b1",
  "0x9bdc06a725c71235",
  "0xc19bf174cf692694",
  "0xe49b69c19ef14ad2",
  "0xefbe4786384f25e3",
  "0x0fc19dc68b8cd5b5",
  "0x240ca1cc77ac9c65",
  "0x2de92c6f592b0275",
  "0x4a7484aa6ea6e483",
  "0x5cb0a9dcbd41fbd4",
  "0x76f988da831153b5",
  "0x983e5152ee66dfab",
  "0xa831c66d2db43210",
  "0xb00327c898fb213f",
  "0xbf597fc7beef0ee4",
  "0xc6e00bf33da88fc2",
  "0xd5a79147930aa725",
  "0x06ca6351e003826f",
  "0x142929670a0e6e70",
  "0x27b70a8546d22ffc",
  "0x2e1b21385c26c926",
  "0x4d2c6dfc5ac42aed",
  "0x53380d139d95b3df",
  "0x650a73548baf63de",
  "0x766a0abb3c77b2a8",
  "0x81c2c92e47edaee6",
  "0x92722c851482353b",
  "0xa2bfe8a14cf10364",
  "0xa81a664bbc423001",
  "0xc24b8b70d0f89791",
  "0xc76c51a30654be30",
  "0xd192e819d6ef5218",
  "0xd69906245565a910",
  "0xf40e35855771202a",
  "0x106aa07032bbd1b8",
  "0x19a4c116b8d2d0c8",
  "0x1e376c085141ab53",
  "0x2748774cdf8eeb99",
  "0x34b0bcb5e19b48a8",
  "0x391c0cb3c5c95a63",
  "0x4ed8aa4ae3418acb",
  "0x5b9cca4f7763e373",
  "0x682e6ff3d6b2b8a3",
  "0x748f82ee5defb2fc",
  "0x78a5636f43172f60",
  "0x84c87814a1f0ab72",
  "0x8cc702081a6439ec",
  "0x90befffa23631e28",
  "0xa4506cebde82bde9",
  "0xbef9a3f7b2c67915",
  "0xc67178f2e372532b",
  "0xca273eceea26619c",
  "0xd186b8c721c0c207",
  "0xeada7dd6cde0eb1e",
  "0xf57d4f7fee6ed178",
  "0x06f067aa72176fba",
  "0x0a637dc5a2c898a6",
  "0x113f9804bef90dae",
  "0x1b710b35131c471b",
  "0x28db77f523047d84",
  "0x32caab7b40c72493",
  "0x3c9ebe0a15c9bebc",
  "0x431d67c49c100d4c",
  "0x4cc5d4becb3e42b6",
  "0x597f299cfc657e2a",
  "0x5fcb6fab3ad6faec",
  "0x6c44198c4a475817"
].map((n) => BigInt(n))))();
var SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
var SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
var SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
var SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
var SHA2_64B = class extends HashMD {
  constructor(outputLen) {
    super(128, outputLen, 16, false);
  }
  // prettier-ignore
  get() {
    const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
  }
  // prettier-ignore
  set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
    this.Ah = Ah | 0;
    this.Al = Al | 0;
    this.Bh = Bh | 0;
    this.Bl = Bl | 0;
    this.Ch = Ch | 0;
    this.Cl = Cl | 0;
    this.Dh = Dh | 0;
    this.Dl = Dl | 0;
    this.Eh = Eh | 0;
    this.El = El | 0;
    this.Fh = Fh | 0;
    this.Fl = Fl | 0;
    this.Gh = Gh | 0;
    this.Gl = Gl | 0;
    this.Hh = Hh | 0;
    this.Hl = Hl | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4) {
      SHA512_W_H[i] = view.getUint32(offset);
      SHA512_W_L[i] = view.getUint32(offset += 4);
    }
    for (let i = 16; i < 80; i++) {
      const W15h = SHA512_W_H[i - 15] | 0;
      const W15l = SHA512_W_L[i - 15] | 0;
      const s0h = rotrSH(W15h, W15l, 1) ^ rotrSH(W15h, W15l, 8) ^ shrSH(W15h, W15l, 7);
      const s0l = rotrSL(W15h, W15l, 1) ^ rotrSL(W15h, W15l, 8) ^ shrSL(W15h, W15l, 7);
      const W2h = SHA512_W_H[i - 2] | 0;
      const W2l = SHA512_W_L[i - 2] | 0;
      const s1h = rotrSH(W2h, W2l, 19) ^ rotrBH(W2h, W2l, 61) ^ shrSH(W2h, W2l, 6);
      const s1l = rotrSL(W2h, W2l, 19) ^ rotrBL(W2h, W2l, 61) ^ shrSL(W2h, W2l, 6);
      const SUMl = add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
      const SUMh = add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
      SHA512_W_H[i] = SUMh | 0;
      SHA512_W_L[i] = SUMl | 0;
    }
    let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    for (let i = 0; i < 80; i++) {
      const sigma1h = rotrSH(Eh, El, 14) ^ rotrSH(Eh, El, 18) ^ rotrBH(Eh, El, 41);
      const sigma1l = rotrSL(Eh, El, 14) ^ rotrSL(Eh, El, 18) ^ rotrBL(Eh, El, 41);
      const CHIh = Eh & Fh ^ ~Eh & Gh;
      const CHIl = El & Fl ^ ~El & Gl;
      const T1ll = add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
      const T1h = add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
      const T1l = T1ll | 0;
      const sigma0h = rotrSH(Ah, Al, 28) ^ rotrBH(Ah, Al, 34) ^ rotrBH(Ah, Al, 39);
      const sigma0l = rotrSL(Ah, Al, 28) ^ rotrBL(Ah, Al, 34) ^ rotrBL(Ah, Al, 39);
      const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
      const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
      Hh = Gh | 0;
      Hl = Gl | 0;
      Gh = Fh | 0;
      Gl = Fl | 0;
      Fh = Eh | 0;
      Fl = El | 0;
      ({ h: Eh, l: El } = add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
      Dh = Ch | 0;
      Dl = Cl | 0;
      Ch = Bh | 0;
      Cl = Bl | 0;
      Bh = Ah | 0;
      Bl = Al | 0;
      const All = add3L(T1l, sigma0l, MAJl);
      Ah = add3H(All, T1h, sigma0h, MAJh);
      Al = All | 0;
    }
    ({ h: Ah, l: Al } = add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
    ({ h: Bh, l: Bl } = add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
    ({ h: Ch, l: Cl } = add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
    ({ h: Dh, l: Dl } = add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
    ({ h: Eh, l: El } = add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
    ({ h: Fh, l: Fl } = add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
    ({ h: Gh, l: Gl } = add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
    ({ h: Hh, l: Hl } = add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
    this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
  }
  roundClean() {
    clean(SHA512_W_H, SHA512_W_L);
  }
  destroy() {
    this.destroyed = true;
    clean(this.buffer);
    this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
};
var _SHA512 = class extends SHA2_64B {
  Ah = SHA512_IV[0] | 0;
  Al = SHA512_IV[1] | 0;
  Bh = SHA512_IV[2] | 0;
  Bl = SHA512_IV[3] | 0;
  Ch = SHA512_IV[4] | 0;
  Cl = SHA512_IV[5] | 0;
  Dh = SHA512_IV[6] | 0;
  Dl = SHA512_IV[7] | 0;
  Eh = SHA512_IV[8] | 0;
  El = SHA512_IV[9] | 0;
  Fh = SHA512_IV[10] | 0;
  Fl = SHA512_IV[11] | 0;
  Gh = SHA512_IV[12] | 0;
  Gl = SHA512_IV[13] | 0;
  Hh = SHA512_IV[14] | 0;
  Hl = SHA512_IV[15] | 0;
  constructor() {
    super(64);
  }
};
var sha256 = /* @__PURE__ */ createHasher(
  () => new _SHA256(),
  /* @__PURE__ */ oidNist(1)
);
var sha512 = /* @__PURE__ */ createHasher(
  () => new _SHA512(),
  /* @__PURE__ */ oidNist(3)
);

// node_modules/.pnpm/@noble+curves@2.2.0/node_modules/@noble/curves/utils.js
var abytes2 = (value, length, title) => abytes(value, length, title);
var anumber2 = anumber;
var bytesToHex2 = bytesToHex;
var concatBytes2 = (...arrays) => concatBytes(...arrays);
var hexToBytes2 = (hex) => hexToBytes(hex);
var isBytes2 = isBytes;
var randomBytes2 = (bytesLength) => randomBytes(bytesLength);
var _0n = /* @__PURE__ */ BigInt(0);
var _1n = /* @__PURE__ */ BigInt(1);
function abool(value, title = "") {
  if (typeof value !== "boolean") {
    const prefix = title && `"${title}" `;
    throw new TypeError(prefix + "expected boolean, got type=" + typeof value);
  }
  return value;
}
function abignumber(n) {
  if (typeof n === "bigint") {
    if (!isPosBig(n))
      throw new RangeError("positive bigint expected, got " + n);
  } else
    anumber2(n);
  return n;
}
function asafenumber(value, title = "") {
  if (typeof value !== "number") {
    const prefix = title && `"${title}" `;
    throw new TypeError(prefix + "expected number, got type=" + typeof value);
  }
  if (!Number.isSafeInteger(value)) {
    const prefix = title && `"${title}" `;
    throw new RangeError(prefix + "expected safe integer, got " + value);
  }
}
function numberToHexUnpadded(num) {
  const hex = abignumber(num).toString(16);
  return hex.length & 1 ? "0" + hex : hex;
}
function hexToNumber(hex) {
  if (typeof hex !== "string")
    throw new TypeError("hex string expected, got " + typeof hex);
  return hex === "" ? _0n : BigInt("0x" + hex);
}
function bytesToNumberBE(bytes) {
  return hexToNumber(bytesToHex(bytes));
}
function bytesToNumberLE(bytes) {
  return hexToNumber(bytesToHex(copyBytes(abytes(bytes)).reverse()));
}
function numberToBytesBE(n, len) {
  anumber(len);
  if (len === 0)
    throw new RangeError("zero length");
  n = abignumber(n);
  const hex = n.toString(16);
  if (hex.length > len * 2)
    throw new RangeError("number too large");
  return hexToBytes(hex.padStart(len * 2, "0"));
}
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
function equalBytes(a, b) {
  a = abytes2(a);
  b = abytes2(b);
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
function copyBytes(bytes) {
  return Uint8Array.from(abytes2(bytes));
}
function asciiToBytes(ascii) {
  if (typeof ascii !== "string")
    throw new TypeError("ascii string expected, got " + typeof ascii);
  return Uint8Array.from(ascii, (c, i) => {
    const charCode = c.charCodeAt(0);
    if (c.length !== 1 || charCode > 127) {
      throw new RangeError(`string contains non-ASCII character "${ascii[i]}" with code ${charCode} at position ${i}`);
    }
    return charCode;
  });
}
var isPosBig = (n) => typeof n === "bigint" && _0n <= n;
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new RangeError("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
function bitLen(n) {
  if (n < _0n)
    throw new Error("expected non-negative bigint, got " + n);
  let len;
  for (len = 0; n > _0n; n >>= _1n, len += 1)
    ;
  return len;
}
var bitMask = (n) => (_1n << BigInt(n)) - _1n;
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  anumber(hashLen, "hashLen");
  anumber(qByteLen, "qByteLen");
  if (typeof hmacFn !== "function")
    throw new TypeError("hmacFn must be a function");
  const u8n = (len) => new Uint8Array(len);
  const NULL = Uint8Array.of();
  const byte0 = Uint8Array.of(0);
  const byte1 = Uint8Array.of(1);
  const _maxDrbgIters = 1e3;
  let v = u8n(hashLen);
  let k = u8n(hashLen);
  let i = 0;
  const reset = () => {
    v.fill(1);
    k.fill(0);
    i = 0;
  };
  const h = (...msgs) => hmacFn(k, concatBytes2(v, ...msgs));
  const reseed = (seed = NULL) => {
    k = h(byte0, seed);
    v = h();
    if (seed.length === 0)
      return;
    k = h(byte1, seed);
    v = h();
  };
  const gen = () => {
    if (i++ >= _maxDrbgIters)
      throw new Error("drbg: tried max amount of iterations");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes2(...out);
  };
  const genUntil = (seed, pred) => {
    reset();
    reseed(seed);
    let res = void 0;
    while ((res = pred(gen())) === void 0)
      reseed();
    reset();
    return res;
  };
  return genUntil;
}
function validateObject(object, fields = {}, optFields = {}) {
  if (Object.prototype.toString.call(object) !== "[object Object]")
    throw new TypeError("expected valid options object");
  function checkField(fieldName, expectedType, isOpt) {
    if (!isOpt && expectedType !== "function" && !Object.hasOwn(object, fieldName))
      throw new TypeError(`param "${fieldName}" is invalid: expected own property`);
    const val = object[fieldName];
    if (isOpt && val === void 0)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new TypeError(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
  }
  const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
  iter(fields, false);
  iter(optFields, true);
}
var notImplemented = () => {
  throw new Error("not implemented");
};

// node_modules/.pnpm/@noble+curves@2.2.0/node_modules/@noble/curves/abstract/modular.js
var _0n2 = /* @__PURE__ */ BigInt(0);
var _1n2 = /* @__PURE__ */ BigInt(1);
var _2n = /* @__PURE__ */ BigInt(2);
var _3n = /* @__PURE__ */ BigInt(3);
var _4n = /* @__PURE__ */ BigInt(4);
var _5n = /* @__PURE__ */ BigInt(5);
var _7n = /* @__PURE__ */ BigInt(7);
var _8n = /* @__PURE__ */ BigInt(8);
var _9n = /* @__PURE__ */ BigInt(9);
var _16n = /* @__PURE__ */ BigInt(16);
function mod(a, b) {
  if (b <= _0n2)
    throw new Error("mod: expected positive modulus, got " + b);
  const result = a % b;
  return result >= _0n2 ? result : b + result;
}
function pow2(x, power2, modulo) {
  if (power2 < _0n2)
    throw new Error("pow2: expected non-negative exponent, got " + power2);
  let res = x;
  while (power2-- > _0n2) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert(number, modulo) {
  if (number === _0n2)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _0n2)
    throw new Error("invert: expected positive modulus, got " + modulo);
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n2, y = _1n2, u = _1n2, v = _0n2;
  while (a !== _0n2) {
    const q = b / a;
    const r = b - a * q;
    const m = x - u * q;
    const n = y - v * q;
    b = a, a = r, x = u, y = v, u = m, v = n;
  }
  const gcd2 = b;
  if (gcd2 !== _1n2)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function assertIsSquare(Fp2, root, n) {
  const F2 = Fp2;
  if (!F2.eql(F2.sqr(root), n))
    throw new Error("Cannot find square root");
}
function sqrt3mod4(Fp2, n) {
  const F2 = Fp2;
  const p1div4 = (F2.ORDER + _1n2) / _4n;
  const root = F2.pow(n, p1div4);
  assertIsSquare(F2, root, n);
  return root;
}
function sqrt5mod8(Fp2, n) {
  const F2 = Fp2;
  const p5div8 = (F2.ORDER - _5n) / _8n;
  const n2 = F2.mul(n, _2n);
  const v = F2.pow(n2, p5div8);
  const nv = F2.mul(n, v);
  const i = F2.mul(F2.mul(nv, _2n), v);
  const root = F2.mul(nv, F2.sub(i, F2.ONE));
  assertIsSquare(F2, root, n);
  return root;
}
function sqrt9mod16(P) {
  const Fp_ = Field(P);
  const tn = tonelliShanks(P);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P + _7n) / _16n;
  return ((Fp2, n) => {
    const F2 = Fp2;
    let tv1 = F2.pow(n, c4);
    let tv2 = F2.mul(tv1, c1);
    const tv3 = F2.mul(tv1, c2);
    const tv4 = F2.mul(tv1, c3);
    const e1 = F2.eql(F2.sqr(tv2), n);
    const e2 = F2.eql(F2.sqr(tv3), n);
    tv1 = F2.cmov(tv1, tv2, e1);
    tv2 = F2.cmov(tv4, tv3, e2);
    const e3 = F2.eql(F2.sqr(tv2), n);
    const root = F2.cmov(tv1, tv2, e3);
    assertIsSquare(F2, root, n);
    return root;
  });
}
function tonelliShanks(P) {
  if (P < _3n)
    throw new Error("sqrt is not defined for small field");
  let Q3 = P - _1n2;
  let S = 0;
  while (Q3 % _2n === _0n2) {
    Q3 /= _2n;
    S++;
  }
  let Z = _2n;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1e3)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q3);
  const Q1div2 = (Q3 + _1n2) / _2n;
  return function tonelliSlow(Fp2, n) {
    const F2 = Fp2;
    if (F2.is0(n))
      return n;
    if (FpLegendre(F2, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = F2.mul(F2.ONE, cc);
    let t = F2.pow(n, Q3);
    let R = F2.pow(n, Q1div2);
    while (!F2.eql(t, F2.ONE)) {
      if (F2.is0(t))
        return F2.ZERO;
      let i = 1;
      let t_tmp = F2.sqr(t);
      while (!F2.eql(t_tmp, F2.ONE)) {
        i++;
        t_tmp = F2.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n2 << BigInt(M - i - 1);
      const b = F2.pow(c, exponent);
      M = i;
      c = F2.sqr(b);
      t = F2.mul(t, c);
      R = F2.mul(R, b);
    }
    return R;
  };
}
function FpSqrt(P) {
  if (P % _4n === _3n)
    return sqrt3mod4;
  if (P % _8n === _5n)
    return sqrt5mod8;
  if (P % _16n === _9n)
    return sqrt9mod16(P);
  return tonelliShanks(P);
}
var isNegativeLE = (num, modulo) => (mod(num, modulo) & _1n2) === _1n2;
var FIELD_FIELDS = [
  "create",
  "isValid",
  "is0",
  "neg",
  "inv",
  "sqrt",
  "sqr",
  "eql",
  "add",
  "sub",
  "mul",
  "pow",
  "div",
  "addN",
  "subN",
  "mulN",
  "sqrN"
];
function validateField(field) {
  const initial = {
    ORDER: "bigint",
    BYTES: "number",
    BITS: "number"
  };
  const opts = FIELD_FIELDS.reduce((map, val) => {
    map[val] = "function";
    return map;
  }, initial);
  validateObject(field, opts);
  asafenumber(field.BYTES, "BYTES");
  asafenumber(field.BITS, "BITS");
  if (field.BYTES < 1 || field.BITS < 1)
    throw new Error("invalid field: expected BYTES/BITS > 0");
  if (field.ORDER <= _1n2)
    throw new Error("invalid field: expected ORDER > 1, got " + field.ORDER);
  return field;
}
function FpPow(Fp2, num, power2) {
  const F2 = Fp2;
  if (power2 < _0n2)
    throw new Error("invalid exponent, negatives unsupported");
  if (power2 === _0n2)
    return F2.ONE;
  if (power2 === _1n2)
    return num;
  let p = F2.ONE;
  let d = num;
  while (power2 > _0n2) {
    if (power2 & _1n2)
      p = F2.mul(p, d);
    d = F2.sqr(d);
    power2 >>= _1n2;
  }
  return p;
}
function FpInvertBatch(Fp2, nums, passZero = false) {
  const F2 = Fp2;
  const inverted = new Array(nums.length).fill(passZero ? F2.ZERO : void 0);
  const multipliedAcc = nums.reduce((acc, num, i) => {
    if (F2.is0(num))
      return acc;
    inverted[i] = acc;
    return F2.mul(acc, num);
  }, F2.ONE);
  const invertedAcc = F2.inv(multipliedAcc);
  nums.reduceRight((acc, num, i) => {
    if (F2.is0(num))
      return acc;
    inverted[i] = F2.mul(acc, inverted[i]);
    return F2.mul(acc, num);
  }, invertedAcc);
  return inverted;
}
function FpLegendre(Fp2, n) {
  const F2 = Fp2;
  const p1mod2 = (F2.ORDER - _1n2) / _2n;
  const powered = F2.pow(n, p1mod2);
  const yes = F2.eql(powered, F2.ONE);
  const zero = F2.eql(powered, F2.ZERO);
  const no = F2.eql(powered, F2.neg(F2.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
function nLength(n, nBitLength) {
  if (nBitLength !== void 0)
    anumber2(nBitLength);
  if (n <= _0n2)
    throw new Error("invalid n length: expected positive n, got " + n);
  if (nBitLength !== void 0 && nBitLength < 1)
    throw new Error("invalid n length: expected positive bit length, got " + nBitLength);
  const bits = bitLen(n);
  if (nBitLength !== void 0 && nBitLength < bits)
    throw new Error(`invalid n length: expected bit length (${bits}) >= n.length (${nBitLength})`);
  const _nBitLength = nBitLength !== void 0 ? nBitLength : bits;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
var FIELD_SQRT = /* @__PURE__ */ new WeakMap();
var _Field = class {
  ORDER;
  BITS;
  BYTES;
  isLE;
  ZERO = _0n2;
  ONE = _1n2;
  _lengths;
  _mod;
  constructor(ORDER, opts = {}) {
    if (ORDER <= _1n2)
      throw new Error("invalid field: expected ORDER > 1, got " + ORDER);
    let _nbitLength = void 0;
    this.isLE = false;
    if (opts != null && typeof opts === "object") {
      if (typeof opts.BITS === "number")
        _nbitLength = opts.BITS;
      if (typeof opts.sqrt === "function")
        Object.defineProperty(this, "sqrt", { value: opts.sqrt, enumerable: true });
      if (typeof opts.isLE === "boolean")
        this.isLE = opts.isLE;
      if (opts.allowedLengths)
        this._lengths = Object.freeze(opts.allowedLengths.slice());
      if (typeof opts.modFromBytes === "boolean")
        this._mod = opts.modFromBytes;
    }
    const { nBitLength, nByteLength } = nLength(ORDER, _nbitLength);
    if (nByteLength > 2048)
      throw new Error("invalid field: expected ORDER of <= 2048 bytes");
    this.ORDER = ORDER;
    this.BITS = nBitLength;
    this.BYTES = nByteLength;
    Object.freeze(this);
  }
  create(num) {
    return mod(num, this.ORDER);
  }
  isValid(num) {
    if (typeof num !== "bigint")
      throw new TypeError("invalid field element: expected bigint, got " + typeof num);
    return _0n2 <= num && num < this.ORDER;
  }
  is0(num) {
    return num === _0n2;
  }
  // is valid and invertible
  isValidNot0(num) {
    return !this.is0(num) && this.isValid(num);
  }
  isOdd(num) {
    return (num & _1n2) === _1n2;
  }
  neg(num) {
    return mod(-num, this.ORDER);
  }
  eql(lhs, rhs) {
    return lhs === rhs;
  }
  sqr(num) {
    return mod(num * num, this.ORDER);
  }
  add(lhs, rhs) {
    return mod(lhs + rhs, this.ORDER);
  }
  sub(lhs, rhs) {
    return mod(lhs - rhs, this.ORDER);
  }
  mul(lhs, rhs) {
    return mod(lhs * rhs, this.ORDER);
  }
  pow(num, power2) {
    return FpPow(this, num, power2);
  }
  div(lhs, rhs) {
    return mod(lhs * invert(rhs, this.ORDER), this.ORDER);
  }
  // Same as above, but doesn't normalize
  sqrN(num) {
    return num * num;
  }
  addN(lhs, rhs) {
    return lhs + rhs;
  }
  subN(lhs, rhs) {
    return lhs - rhs;
  }
  mulN(lhs, rhs) {
    return lhs * rhs;
  }
  inv(num) {
    return invert(num, this.ORDER);
  }
  sqrt(num) {
    let sqrt = FIELD_SQRT.get(this);
    if (!sqrt)
      FIELD_SQRT.set(this, sqrt = FpSqrt(this.ORDER));
    return sqrt(this, num);
  }
  toBytes(num) {
    return this.isLE ? numberToBytesLE(num, this.BYTES) : numberToBytesBE(num, this.BYTES);
  }
  fromBytes(bytes, skipValidation = false) {
    abytes2(bytes);
    const { _lengths: allowedLengths, BYTES, isLE: isLE2, ORDER, _mod: modFromBytes } = this;
    if (allowedLengths) {
      if (bytes.length < 1 || !allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
        throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
      }
      const padded = new Uint8Array(BYTES);
      padded.set(bytes, isLE2 ? 0 : padded.length - bytes.length);
      bytes = padded;
    }
    if (bytes.length !== BYTES)
      throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
    let scalar = isLE2 ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
    if (modFromBytes)
      scalar = mod(scalar, ORDER);
    if (!skipValidation) {
      if (!this.isValid(scalar))
        throw new Error("invalid field element: outside of range 0..ORDER");
    }
    return scalar;
  }
  // TODO: we don't need it here, move out to separate fn
  invertBatch(lst) {
    return FpInvertBatch(this, lst);
  }
  // We can't move this out because Fp6, Fp12 implement it
  // and it's unclear what to return in there.
  cmov(a, b, condition) {
    abool(condition, "condition");
    return condition ? b : a;
  }
};
Object.freeze(_Field.prototype);
function Field(ORDER, opts = {}) {
  return new _Field(ORDER, opts);
}
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  if (fieldOrder <= _1n2)
    throw new Error("field order must be greater than 1");
  const bitLength = bitLen(fieldOrder - _1n2);
  return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE2 = false) {
  abytes2(key);
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = Math.max(getMinHashLength(fieldOrder), 16);
  if (len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num = isLE2 ? bytesToNumberLE(key) : bytesToNumberBE(key);
  const reduced = mod(num, fieldOrder - _1n2) + _1n2;
  return isLE2 ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}

// node_modules/.pnpm/@noble+curves@2.2.0/node_modules/@noble/curves/abstract/curve.js
var _0n3 = /* @__PURE__ */ BigInt(0);
var _1n3 = /* @__PURE__ */ BigInt(1);
function negateCt(condition, item) {
  const neg = item.negate();
  return condition ? neg : item;
}
function normalizeZ(c, points) {
  const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
function validateW(W, bits) {
  if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
    throw new Error("invalid window size, expected [1.." + bits + "], got W=" + W);
}
function calcWOpts(W, scalarBits) {
  validateW(W, scalarBits);
  const windows = Math.ceil(scalarBits / W) + 1;
  const windowSize = 2 ** (W - 1);
  const maxNumber = 2 ** W;
  const mask = bitMask(W);
  const shiftBy = BigInt(W);
  return { windows, windowSize, mask, maxNumber, shiftBy };
}
function calcOffsets(n, window, wOpts) {
  const { windowSize, mask, maxNumber, shiftBy } = wOpts;
  let wbits = Number(n & mask);
  let nextN = n >> shiftBy;
  if (wbits > windowSize) {
    wbits -= maxNumber;
    nextN += _1n3;
  }
  const offsetStart = window * windowSize;
  const offset = offsetStart + Math.abs(wbits) - 1;
  const isZero = wbits === 0;
  const isNeg = wbits < 0;
  const isNegF = window % 2 !== 0;
  const offsetF = offsetStart;
  return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
var pointPrecomputes = /* @__PURE__ */ new WeakMap();
var pointWindowSizes = /* @__PURE__ */ new WeakMap();
function getW(P) {
  return pointWindowSizes.get(P) || 1;
}
function assert0(n) {
  if (n !== _0n3)
    throw new Error("invalid wNAF");
}
var wNAF = class {
  BASE;
  ZERO;
  Fn;
  bits;
  // Parametrized with a given Point class (not individual point)
  constructor(Point, bits) {
    this.BASE = Point.BASE;
    this.ZERO = Point.ZERO;
    this.Fn = Point.Fn;
    this.bits = bits;
  }
  // non-const time multiplication ladder
  _unsafeLadder(elm, n, p = this.ZERO) {
    let d = elm;
    while (n > _0n3) {
      if (n & _1n3)
        p = p.add(d);
      d = d.double();
      n >>= _1n3;
    }
    return p;
  }
  /**
   * Creates a wNAF precomputation window. Used for caching.
   * Default window size is set by `utils.precompute()` and is equal to 8.
   * Number of precomputed points depends on the curve size:
   * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
   * - 𝑊 is the window size
   * - 𝑛 is the bitlength of the curve order.
   * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
   * @param point - Point instance
   * @param W - window size
   * @returns precomputed point tables flattened to a single array
   */
  precomputeWindow(point, W) {
    const { windows, windowSize } = calcWOpts(W, this.bits);
    const points = [];
    let p = point;
    let base = p;
    for (let window = 0; window < windows; window++) {
      base = p;
      points.push(base);
      for (let i = 1; i < windowSize; i++) {
        base = base.add(p);
        points.push(base);
      }
      p = base.double();
    }
    return points;
  }
  /**
   * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
   * More compact implementation:
   * https://github.com/paulmillr/noble-secp256k1/blob/47cb1669b6e506ad66b35fe7d76132ae97465da2/index.ts#L502-L541
   * @returns real and fake (for const-time) points
   */
  wNAF(W, precomputes, n) {
    if (!this.Fn.isValid(n))
      throw new Error("invalid scalar");
    let p = this.ZERO;
    let f = this.BASE;
    const wo = calcWOpts(W, this.bits);
    for (let window = 0; window < wo.windows; window++) {
      const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window, wo);
      n = nextN;
      if (isZero) {
        f = f.add(negateCt(isNegF, precomputes[offsetF]));
      } else {
        p = p.add(negateCt(isNeg, precomputes[offset]));
      }
    }
    assert0(n);
    return { p, f };
  }
  /**
   * Implements unsafe EC multiplication using precomputed tables
   * and w-ary non-adjacent form.
   * @param acc - accumulator point to add result of multiplication
   * @returns point
   */
  wNAFUnsafe(W, precomputes, n, acc = this.ZERO) {
    const wo = calcWOpts(W, this.bits);
    for (let window = 0; window < wo.windows; window++) {
      if (n === _0n3)
        break;
      const { nextN, offset, isZero, isNeg } = calcOffsets(n, window, wo);
      n = nextN;
      if (isZero) {
        continue;
      } else {
        const item = precomputes[offset];
        acc = acc.add(isNeg ? item.negate() : item);
      }
    }
    assert0(n);
    return acc;
  }
  getPrecomputes(W, point, transform) {
    let comp = pointPrecomputes.get(point);
    if (!comp) {
      comp = this.precomputeWindow(point, W);
      if (W !== 1) {
        if (typeof transform === "function")
          comp = transform(comp);
        pointPrecomputes.set(point, comp);
      }
    }
    return comp;
  }
  cached(point, scalar, transform) {
    const W = getW(point);
    return this.wNAF(W, this.getPrecomputes(W, point, transform), scalar);
  }
  unsafe(point, scalar, transform, prev) {
    const W = getW(point);
    if (W === 1)
      return this._unsafeLadder(point, scalar, prev);
    return this.wNAFUnsafe(W, this.getPrecomputes(W, point, transform), scalar, prev);
  }
  // We calculate precomputes for elliptic curve point multiplication
  // using windowed method. This specifies window size and
  // stores precomputed values. Usually only base point would be precomputed.
  createCache(P, W) {
    validateW(W, this.bits);
    pointWindowSizes.set(P, W);
    pointPrecomputes.delete(P);
  }
  hasCache(elm) {
    return getW(elm) !== 1;
  }
};
function mulEndoUnsafe(Point, point, k1, k2) {
  let acc = point;
  let p1 = Point.ZERO;
  let p2 = Point.ZERO;
  while (k1 > _0n3 || k2 > _0n3) {
    if (k1 & _1n3)
      p1 = p1.add(acc);
    if (k2 & _1n3)
      p2 = p2.add(acc);
    acc = acc.double();
    k1 >>= _1n3;
    k2 >>= _1n3;
  }
  return { p1, p2 };
}
function createField(order, field, isLE2) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE: isLE2 });
  }
}
function createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
  if (FpFnLE === void 0)
    FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object")
    throw new Error(`expected valid ${type} CURVE object`);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(typeof val === "bigint" && val > _0n3))
      throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp2 = createField(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn2 = createField(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = type === "weierstrass" ? "b" : "d";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    if (!Fp2.isValid(CURVE[p]))
      throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp: Fp2, Fn: Fn2 };
}
function createKeygen(randomSecretKey, getPublicKey) {
  return function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  };
}

// node_modules/.pnpm/@noble+curves@2.2.0/node_modules/@noble/curves/abstract/edwards.js
var _0n4 = /* @__PURE__ */ BigInt(0);
var _1n4 = /* @__PURE__ */ BigInt(1);
var _2n2 = /* @__PURE__ */ BigInt(2);
var _8n2 = /* @__PURE__ */ BigInt(8);
function isEdValidXY(Fp2, CURVE, x, y) {
  const x2 = Fp2.sqr(x);
  const y2 = Fp2.sqr(y);
  const left = Fp2.add(Fp2.mul(CURVE.a, x2), y2);
  const right = Fp2.add(Fp2.ONE, Fp2.mul(CURVE.d, Fp2.mul(x2, y2)));
  return Fp2.eql(left, right);
}
function edwards(params, extraOpts = {}) {
  const opts = extraOpts;
  const validated = createCurveFields("edwards", params, opts, opts.FpFnLE);
  const { Fp: Fp2, Fn: Fn2 } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor } = CURVE;
  validateObject(opts, {}, { uvRatio: "function" });
  const MASK = _2n2 << BigInt(Fn2.BYTES * 8) - _1n4;
  const modP = (n) => Fp2.create(n);
  const uvRatio2 = opts.uvRatio === void 0 ? (u, v) => {
    try {
      return { isValid: true, value: Fp2.sqrt(Fp2.div(u, v)) };
    } catch (e) {
      return { isValid: false, value: _0n4 };
    }
  } : opts.uvRatio;
  if (!isEdValidXY(Fp2, CURVE, CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  function acoord(title, n, banZero = false) {
    const min = banZero ? _1n4 : _0n4;
    aInRange("coordinate " + title, n, min, MASK);
    return n;
  }
  function aedpoint(other) {
    if (!(other instanceof Point))
      throw new Error("EdwardsPoint expected");
  }
  class Point {
    // base / generator point
    static BASE = new Point(CURVE.Gx, CURVE.Gy, _1n4, modP(CURVE.Gx * CURVE.Gy));
    // zero / infinity / identity point
    static ZERO = new Point(_0n4, _1n4, _1n4, _0n4);
    // 0, 1, 1, 0
    // math field
    static Fp = Fp2;
    // scalar field
    static Fn = Fn2;
    X;
    Y;
    Z;
    T;
    constructor(X, Y, Z, T) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y);
      this.Z = acoord("z", Z, true);
      this.T = acoord("t", T);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    /**
     * Create one extended Edwards point from affine coordinates.
     * Does NOT validate that the point is on-curve or torsion-free.
     * Use `.assertValidity()` on adversarial inputs.
     */
    static fromAffine(p) {
      if (p instanceof Point)
        throw new Error("extended point not allowed");
      const { x, y } = p || {};
      acoord("x", x);
      acoord("y", y);
      return new Point(x, y, _1n4, modP(x * y));
    }
    // Uses algo from RFC8032 5.1.3.
    static fromBytes(bytes, zip215 = false) {
      const len = Fp2.BYTES;
      const { a, d } = CURVE;
      bytes = copyBytes(abytes2(bytes, len, "point"));
      abool(zip215, "zip215");
      const normed = copyBytes(bytes);
      const lastByte = bytes[len - 1];
      normed[len - 1] = lastByte & ~128;
      const y = bytesToNumberLE(normed);
      const max = zip215 ? MASK : Fp2.ORDER;
      aInRange("point.y", y, _0n4, max);
      const y2 = modP(y * y);
      const u = modP(y2 - _1n4);
      const v = modP(d * y2 - a);
      let { isValid, value: x } = uvRatio2(u, v);
      if (!isValid)
        throw new Error("bad point: invalid y coordinate");
      const isXOdd = (x & _1n4) === _1n4;
      const isLastByteOdd = (lastByte & 128) !== 0;
      if (!zip215 && x === _0n4 && isLastByteOdd)
        throw new Error("bad point: x=0 and x_0=1");
      if (isLastByteOdd !== isXOdd)
        x = modP(-x);
      return Point.fromAffine({ x, y });
    }
    static fromHex(hex, zip215 = false) {
      return Point.fromBytes(hexToBytes2(hex), zip215);
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    precompute(windowSize = 8, isLazy = true) {
      wnaf.createCache(this, windowSize);
      if (!isLazy)
        this.multiply(_2n2);
      return this;
    }
    // Useful in fromAffine() - not for fromBytes(), which always created valid points.
    assertValidity() {
      const p = this;
      const { a, d } = CURVE;
      if (p.is0())
        throw new Error("bad point: ZERO");
      const { X, Y, Z, T } = p;
      const X2 = modP(X * X);
      const Y2 = modP(Y * Y);
      const Z2 = modP(Z * Z);
      const Z4 = modP(Z2 * Z2);
      const aX2 = modP(X2 * a);
      const left = modP(Z2 * modP(aX2 + Y2));
      const right = modP(Z4 + modP(d * modP(X2 * Y2)));
      if (left !== right)
        throw new Error("bad point: equation left != right (1)");
      const XY = modP(X * Y);
      const ZT = modP(Z * T);
      if (XY !== ZT)
        throw new Error("bad point: equation left != right (2)");
    }
    // Compare one point to another.
    equals(other) {
      aedpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const X1Z2 = modP(X1 * Z2);
      const X2Z1 = modP(X2 * Z1);
      const Y1Z2 = modP(Y1 * Z2);
      const Y2Z1 = modP(Y2 * Z1);
      return X1Z2 === X2Z1 && Y1Z2 === Y2Z1;
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    negate() {
      return new Point(modP(-this.X), this.Y, this.Z, modP(-this.T));
    }
    // Fast algo for doubling Extended Point.
    // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#doubling-dbl-2008-hwcd
    // Cost: 4M + 4S + 1*a + 6add + 1*2.
    double() {
      const { a } = CURVE;
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const A = modP(X1 * X1);
      const B = modP(Y1 * Y1);
      const C = modP(_2n2 * modP(Z1 * Z1));
      const D3 = modP(a * A);
      const x1y1 = X1 + Y1;
      const E = modP(modP(x1y1 * x1y1) - A - B);
      const G = D3 + B;
      const F2 = G - C;
      const H = D3 - B;
      const X3 = modP(E * F2);
      const Y3 = modP(G * H);
      const T3 = modP(E * H);
      const Z3 = modP(F2 * G);
      return new Point(X3, Y3, Z3, T3);
    }
    // Fast algo for adding 2 Extended Points.
    // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#addition-add-2008-hwcd
    // Cost: 9M + 1*a + 1*d + 7add.
    add(other) {
      aedpoint(other);
      const { a, d } = CURVE;
      const { X: X1, Y: Y1, Z: Z1, T: T1 } = this;
      const { X: X2, Y: Y2, Z: Z2, T: T2 } = other;
      const A = modP(X1 * X2);
      const B = modP(Y1 * Y2);
      const C = modP(T1 * d * T2);
      const D3 = modP(Z1 * Z2);
      const E = modP((X1 + Y1) * (X2 + Y2) - A - B);
      const F2 = D3 - C;
      const G = D3 + C;
      const H = modP(B - a * A);
      const X3 = modP(E * F2);
      const Y3 = modP(G * H);
      const T3 = modP(E * H);
      const Z3 = modP(F2 * G);
      return new Point(X3, Y3, Z3, T3);
    }
    subtract(other) {
      aedpoint(other);
      return this.add(other.negate());
    }
    // Constant-time multiplication.
    multiply(scalar) {
      if (!Fn2.isValidNot0(scalar))
        throw new RangeError("invalid scalar: expected 1 <= sc < curve.n");
      const { p, f } = wnaf.cached(this, scalar, (p2) => normalizeZ(Point, p2));
      return normalizeZ(Point, [p, f])[0];
    }
    // Non-constant-time multiplication. Uses double-and-add algorithm.
    // It's faster, but should only be used when you don't care about
    // an exposed private key e.g. sig verification.
    // Keeps the same subgroup-scalar contract: 0 is allowed for public-scalar callers, but
    // n and larger values are rejected instead of being reduced mod n to the identity point.
    multiplyUnsafe(scalar) {
      if (!Fn2.isValid(scalar))
        throw new RangeError("invalid scalar: expected 0 <= sc < curve.n");
      if (scalar === _0n4)
        return Point.ZERO;
      if (this.is0() || scalar === _1n4)
        return this;
      return wnaf.unsafe(this, scalar, (p) => normalizeZ(Point, p));
    }
    // Checks if point is of small order.
    // If you add something to small order point, you will have "dirty"
    // point with torsion component.
    // Clears cofactor and checks if the result is 0.
    isSmallOrder() {
      return this.clearCofactor().is0();
    }
    // Multiplies point by curve order and checks if the result is 0.
    // Returns `false` is the point is dirty.
    isTorsionFree() {
      return wnaf.unsafe(this, CURVE.n).is0();
    }
    // Converts Extended point to default (x, y) coordinates.
    // Can accept precomputed Z^-1 - for example, from invertBatch.
    toAffine(invertedZ) {
      const p = this;
      let iz = invertedZ;
      const { X, Y, Z } = p;
      const is0 = p.is0();
      if (iz == null)
        iz = is0 ? _8n2 : Fp2.inv(Z);
      const x = modP(X * iz);
      const y = modP(Y * iz);
      const zz = Fp2.mul(Z, iz);
      if (is0)
        return { x: _0n4, y: _1n4 };
      if (zz !== _1n4)
        throw new Error("invZ was invalid");
      return { x, y };
    }
    clearCofactor() {
      if (cofactor === _1n4)
        return this;
      return this.multiplyUnsafe(cofactor);
    }
    toBytes() {
      const { x, y } = this.toAffine();
      const bytes = Fp2.toBytes(y);
      bytes[bytes.length - 1] |= x & _1n4 ? 128 : 0;
      return bytes;
    }
    toHex() {
      return bytesToHex2(this.toBytes());
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
  }
  const wnaf = new wNAF(Point, Fn2.BITS);
  if (Fn2.BITS >= 8)
    Point.BASE.precompute(8);
  Object.freeze(Point.prototype);
  Object.freeze(Point);
  return Point;
}
var PrimeEdwardsPoint = class {
  static BASE;
  static ZERO;
  static Fp;
  static Fn;
  ep;
  /**
   * Wrap one internal Edwards representative directly.
   * This is not a canonical encoding boundary: alternate Edwards
   * representatives may still describe the same abstract wrapper element.
   */
  constructor(ep) {
    this.ep = ep;
  }
  // Static methods that must be implemented by subclasses
  static fromBytes(_bytes) {
    notImplemented();
  }
  static fromHex(_hex) {
    notImplemented();
  }
  get x() {
    return this.toAffine().x;
  }
  get y() {
    return this.toAffine().y;
  }
  // Common implementations
  clearCofactor() {
    return this;
  }
  assertValidity() {
    this.ep.assertValidity();
  }
  /**
   * Return affine coordinates of the current internal Edwards representative.
   * This is a convenience helper, not a canonical Ristretto/Decaf encoding.
   * Equal abstract elements may expose different `x` / `y`; use
   * `toBytes()` / `fromBytes()` for canonical roundtrips.
   */
  toAffine(invertedZ) {
    return this.ep.toAffine(invertedZ);
  }
  toHex() {
    return bytesToHex2(this.toBytes());
  }
  toString() {
    return this.toHex();
  }
  isTorsionFree() {
    return true;
  }
  isSmallOrder() {
    return false;
  }
  add(other) {
    this.assertSame(other);
    return this.init(this.ep.add(other.ep));
  }
  subtract(other) {
    this.assertSame(other);
    return this.init(this.ep.subtract(other.ep));
  }
  multiply(scalar) {
    return this.init(this.ep.multiply(scalar));
  }
  multiplyUnsafe(scalar) {
    return this.init(this.ep.multiplyUnsafe(scalar));
  }
  double() {
    return this.init(this.ep.double());
  }
  negate() {
    return this.init(this.ep.negate());
  }
  precompute(windowSize, isLazy) {
    this.ep.precompute(windowSize, isLazy);
    return this;
  }
};
function eddsa(Point, cHash, eddsaOpts = {}) {
  if (typeof cHash !== "function")
    throw new Error('"hash" function param is required');
  const hash = cHash;
  const opts = eddsaOpts;
  validateObject(opts, {}, {
    adjustScalarBytes: "function",
    randomBytes: "function",
    domain: "function",
    prehash: "function",
    zip215: "boolean",
    mapToCurve: "function"
  });
  const { prehash } = opts;
  const { BASE, Fp: Fp2, Fn: Fn2 } = Point;
  const outputLen = hash.outputLen;
  const expectedLen = 2 * Fp2.BYTES;
  if (outputLen !== void 0) {
    asafenumber(outputLen, "hash.outputLen");
    if (outputLen !== expectedLen)
      throw new Error(`hash.outputLen must be ${expectedLen}, got ${outputLen}`);
  }
  const randomBytes4 = opts.randomBytes === void 0 ? randomBytes2 : opts.randomBytes;
  const adjustScalarBytes2 = opts.adjustScalarBytes === void 0 ? (bytes) => bytes : opts.adjustScalarBytes;
  const domain = opts.domain === void 0 ? (data, ctx, phflag) => {
    abool(phflag, "phflag");
    if (ctx.length || phflag)
      throw new Error("Contexts/pre-hash are not supported");
    return data;
  } : opts.domain;
  function modN_LE(hash2) {
    return Fn2.create(bytesToNumberLE(hash2));
  }
  function getPrivateScalar(key) {
    const len = lengths.secretKey;
    abytes2(key, lengths.secretKey, "secretKey");
    const hashed = abytes2(hash(key), 2 * len, "hashedSecretKey");
    const head = adjustScalarBytes2(hashed.slice(0, len));
    const prefix = hashed.slice(len, 2 * len);
    const scalar = modN_LE(head);
    return { head, prefix, scalar };
  }
  function getExtendedPublicKey(secretKey) {
    const { head, prefix, scalar } = getPrivateScalar(secretKey);
    const point = BASE.multiply(scalar);
    const pointBytes = point.toBytes();
    return { head, prefix, scalar, point, pointBytes };
  }
  function getPublicKey(secretKey) {
    return getExtendedPublicKey(secretKey).pointBytes;
  }
  function hashDomainToScalar(context = Uint8Array.of(), ...msgs) {
    const msg = concatBytes2(...msgs);
    return modN_LE(hash(domain(msg, abytes2(context, void 0, "context"), !!prehash)));
  }
  function sign(msg, secretKey, options = {}) {
    msg = abytes2(msg, void 0, "message");
    if (prehash)
      msg = prehash(msg);
    const { prefix, scalar, pointBytes } = getExtendedPublicKey(secretKey);
    const r = hashDomainToScalar(options.context, prefix, msg);
    const R = BASE.multiply(r).toBytes();
    const k = hashDomainToScalar(options.context, R, pointBytes, msg);
    const s = Fn2.create(r + k * scalar);
    if (!Fn2.isValid(s))
      throw new Error("sign failed: invalid s");
    const rs = concatBytes2(R, Fn2.toBytes(s));
    return abytes2(rs, lengths.signature, "result");
  }
  const verifyOpts = {
    zip215: opts.zip215
  };
  function verify(sig, msg, publicKey, options = verifyOpts) {
    const { context } = options;
    const zip215 = options.zip215 === void 0 ? !!verifyOpts.zip215 : options.zip215;
    const len = lengths.signature;
    sig = abytes2(sig, len, "signature");
    msg = abytes2(msg, void 0, "message");
    publicKey = abytes2(publicKey, lengths.publicKey, "publicKey");
    if (zip215 !== void 0)
      abool(zip215, "zip215");
    if (prehash)
      msg = prehash(msg);
    const mid = len / 2;
    const r = sig.subarray(0, mid);
    const s = bytesToNumberLE(sig.subarray(mid, len));
    let A, R, SB;
    try {
      A = Point.fromBytes(publicKey, zip215);
      R = Point.fromBytes(r, zip215);
      SB = BASE.multiplyUnsafe(s);
    } catch (error) {
      return false;
    }
    if (!zip215 && A.isSmallOrder())
      return false;
    const k = hashDomainToScalar(context, r, publicKey, msg);
    const RkA = R.add(A.multiplyUnsafe(k));
    return RkA.subtract(SB).clearCofactor().is0();
  }
  const _size = Fp2.BYTES;
  const lengths = {
    secretKey: _size,
    publicKey: _size,
    signature: 2 * _size,
    seed: _size
  };
  function randomSecretKey(seed) {
    seed = seed === void 0 ? randomBytes4(lengths.seed) : seed;
    return abytes2(seed, lengths.seed, "seed");
  }
  function isValidSecretKey(key) {
    return isBytes2(key) && key.length === lengths.secretKey;
  }
  function isValidPublicKey(key, zip215) {
    try {
      return !!Point.fromBytes(key, zip215 === void 0 ? verifyOpts.zip215 : zip215);
    } catch (error) {
      return false;
    }
  }
  const utils = {
    getExtendedPublicKey,
    randomSecretKey,
    isValidSecretKey,
    isValidPublicKey,
    /**
     * Converts ed public key to x public key. Uses formula:
     * - ed25519:
     *   - `(u, v) = ((1+y)/(1-y), sqrt(-486664)*u/x)`
     *   - `(x, y) = (sqrt(-486664)*u/v, (u-1)/(u+1))`
     * - ed448:
     *   - `(u, v) = ((y-1)/(y+1), sqrt(156324)*u/x)`
     *   - `(x, y) = (sqrt(156324)*u/v, (1+u)/(1-u))`
     */
    toMontgomery(publicKey) {
      const { y } = Point.fromBytes(publicKey);
      const size = lengths.publicKey;
      const is25519 = size === 32;
      if (!is25519 && size !== 57)
        throw new Error("only defined for 25519 and 448");
      const u = is25519 ? Fp2.div(_1n4 + y, _1n4 - y) : Fp2.div(y - _1n4, y + _1n4);
      return Fp2.toBytes(u);
    },
    toMontgomerySecret(secretKey) {
      const size = lengths.secretKey;
      abytes2(secretKey, size);
      const hashed = hash(secretKey.subarray(0, size));
      return adjustScalarBytes2(hashed).subarray(0, size);
    }
  };
  Object.freeze(lengths);
  Object.freeze(utils);
  return Object.freeze({
    keygen: createKeygen(randomSecretKey, getPublicKey),
    getPublicKey,
    sign,
    verify,
    utils,
    Point,
    lengths
  });
}

// node_modules/.pnpm/@noble+curves@2.2.0/node_modules/@noble/curves/abstract/fft.js
function checkU32(n) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 4294967295)
    throw new Error("wrong u32 integer:" + n);
  return n;
}
function isPowerOfTwo(x) {
  checkU32(x);
  return (x & x - 1) === 0 && x !== 0;
}
function reverseBits(n, bits) {
  checkU32(n);
  if (!Number.isSafeInteger(bits) || bits < 0 || bits > 32)
    throw new Error(`expected integer 0 <= bits <= 32, got ${bits}`);
  let reversed = 0;
  for (let i = 0; i < bits; i++, n >>>= 1)
    reversed = reversed << 1 | n & 1;
  return reversed >>> 0;
}
function log2(n) {
  checkU32(n);
  return 31 - Math.clz32(n);
}
function bitReversalInplace(values) {
  const n = values.length;
  if (!isPowerOfTwo(n))
    throw new Error("expected positive power-of-two length, got " + n);
  const bits = log2(n);
  for (let i = 0; i < n; i++) {
    const j = reverseBits(i, bits);
    if (i < j) {
      const tmp = values[i];
      values[i] = values[j];
      values[j] = tmp;
    }
  }
  return values;
}
var FFTCore = (F2, coreOpts) => {
  const { N: N3, roots, dit, invertButterflies = false, skipStages = 0, brp = true } = coreOpts;
  const bits = log2(N3);
  if (!isPowerOfTwo(N3))
    throw new Error("FFT: Polynomial size should be power of two");
  if (roots.length !== N3)
    throw new Error(`FFT: wrong roots length: expected ${N3}, got ${roots.length}`);
  const isDit = dit !== invertButterflies;
  isDit;
  return (values) => {
    if (values.length !== N3)
      throw new Error("FFT: wrong Polynomial length");
    if (dit && brp)
      bitReversalInplace(values);
    for (let i = 0, g = 1; i < bits - skipStages; i++) {
      const s = dit ? i + 1 + skipStages : bits - i;
      const m = 1 << s;
      const m2 = m >> 1;
      const stride = N3 >> s;
      for (let k = 0; k < N3; k += m) {
        for (let j = 0, grp = g++; j < m2; j++) {
          const rootPos = invertButterflies ? dit ? N3 - grp : grp : j * stride;
          const i0 = k + j;
          const i1 = k + j + m2;
          const omega = roots[rootPos];
          const b = values[i1];
          const a = values[i0];
          if (isDit) {
            const t = F2.mul(b, omega);
            values[i0] = F2.add(a, t);
            values[i1] = F2.sub(a, t);
          } else if (invertButterflies) {
            values[i0] = F2.add(b, a);
            values[i1] = F2.mul(F2.sub(b, a), omega);
          } else {
            values[i0] = F2.add(a, b);
            values[i1] = F2.mul(F2.sub(a, b), omega);
          }
        }
      }
    }
    if (!dit && brp)
      bitReversalInplace(values);
    return values;
  };
};

// node_modules/.pnpm/@noble+curves@2.2.0/node_modules/@noble/curves/abstract/hash-to-curve.js
function i2osp(value, length) {
  asafenumber(value);
  asafenumber(length);
  if (length < 0 || length > 4)
    throw new Error("invalid I2OSP length: " + length);
  if (value < 0 || value > 2 ** (8 * length) - 1)
    throw new Error("invalid I2OSP input: " + value);
  const res = Array.from({ length }).fill(0);
  for (let i = length - 1; i >= 0; i--) {
    res[i] = value & 255;
    value >>>= 8;
  }
  return new Uint8Array(res);
}
function strxor(a, b) {
  const arr = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    arr[i] = a[i] ^ b[i];
  }
  return arr;
}
function normDST(DST) {
  if (!isBytes2(DST) && typeof DST !== "string")
    throw new Error("DST must be Uint8Array or ascii string");
  const dst = typeof DST === "string" ? asciiToBytes(DST) : DST;
  if (dst.length === 0)
    throw new Error("DST must be non-empty");
  return dst;
}
function expand_message_xmd(msg, DST, lenInBytes, H) {
  abytes2(msg);
  asafenumber(lenInBytes);
  DST = normDST(DST);
  if (DST.length > 255)
    DST = H(concatBytes2(asciiToBytes("H2C-OVERSIZE-DST-"), DST));
  const { outputLen: b_in_bytes, blockLen: r_in_bytes } = H;
  const ell = Math.ceil(lenInBytes / b_in_bytes);
  if (lenInBytes > 65535 || ell > 255)
    throw new Error("expand_message_xmd: invalid lenInBytes");
  const DST_prime = concatBytes2(DST, i2osp(DST.length, 1));
  const Z_pad = new Uint8Array(r_in_bytes);
  const l_i_b_str = i2osp(lenInBytes, 2);
  const b = new Array(ell);
  const b_0 = H(concatBytes2(Z_pad, msg, l_i_b_str, i2osp(0, 1), DST_prime));
  b[0] = H(concatBytes2(b_0, i2osp(1, 1), DST_prime));
  for (let i = 1; i < ell; i++) {
    const args = [strxor(b_0, b[i - 1]), i2osp(i + 1, 1), DST_prime];
    b[i] = H(concatBytes2(...args));
  }
  const pseudo_random_bytes = concatBytes2(...b);
  return pseudo_random_bytes.slice(0, lenInBytes);
}
var _DST_scalar = "HashToScalar-";

// node_modules/.pnpm/@noble+curves@2.2.0/node_modules/@noble/curves/ed25519.js
var _0n5 = /* @__PURE__ */ BigInt(0);
var _1n5 = /* @__PURE__ */ BigInt(1);
var _2n3 = /* @__PURE__ */ BigInt(2);
var _5n2 = /* @__PURE__ */ BigInt(5);
var _8n3 = /* @__PURE__ */ BigInt(8);
var ed25519_CURVE_p = /* @__PURE__ */ BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed");
var ed25519_CURVE = /* @__PURE__ */ (() => ({
  p: ed25519_CURVE_p,
  n: BigInt("0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed"),
  h: _8n3,
  a: BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffec"),
  d: BigInt("0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3"),
  Gx: BigInt("0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a"),
  Gy: BigInt("0x6666666666666666666666666666666666666666666666666666666666666658")
}))();
function ed25519_pow_2_252_3(x) {
  const _10n = BigInt(10), _20n = BigInt(20), _40n = BigInt(40), _80n = BigInt(80);
  const P = ed25519_CURVE_p;
  const x2 = x * x % P;
  const b2 = x2 * x % P;
  const b4 = pow2(b2, _2n3, P) * b2 % P;
  const b5 = pow2(b4, _1n5, P) * x % P;
  const b10 = pow2(b5, _5n2, P) * b5 % P;
  const b20 = pow2(b10, _10n, P) * b10 % P;
  const b40 = pow2(b20, _20n, P) * b20 % P;
  const b80 = pow2(b40, _40n, P) * b40 % P;
  const b160 = pow2(b80, _80n, P) * b80 % P;
  const b240 = pow2(b160, _80n, P) * b80 % P;
  const b250 = pow2(b240, _10n, P) * b10 % P;
  const pow_p_5_8 = pow2(b250, _2n3, P) * x % P;
  return { pow_p_5_8, b2 };
}
function adjustScalarBytes(bytes) {
  bytes[0] &= 248;
  bytes[31] &= 127;
  bytes[31] |= 64;
  return bytes;
}
var ED25519_SQRT_M1 = /* @__PURE__ */ BigInt("19681161376707505956807079304988542015446066515923890162744021073123829784752");
function uvRatio(u, v) {
  const P = ed25519_CURVE_p;
  const v3 = mod(v * v * v, P);
  const v7 = mod(v3 * v3 * v, P);
  const pow = ed25519_pow_2_252_3(u * v7).pow_p_5_8;
  let x = mod(u * v3 * pow, P);
  const vx2 = mod(v * x * x, P);
  const root1 = x;
  const root2 = mod(x * ED25519_SQRT_M1, P);
  const useRoot1 = vx2 === u;
  const useRoot2 = vx2 === mod(-u, P);
  const noRoot = vx2 === mod(-u * ED25519_SQRT_M1, P);
  if (useRoot1)
    x = root1;
  if (useRoot2 || noRoot)
    x = root2;
  if (isNegativeLE(x, P))
    x = mod(-x, P);
  return { isValid: useRoot1 || useRoot2, value: x };
}
var ed25519_Point = /* @__PURE__ */ edwards(ed25519_CURVE, { uvRatio });
var Fp = /* @__PURE__ */ (() => ed25519_Point.Fp)();
var Fn = /* @__PURE__ */ (() => ed25519_Point.Fn)();
function ed(opts) {
  return eddsa(ed25519_Point, sha512, Object.assign({ adjustScalarBytes, zip215: true }, opts));
}
var ed25519 = /* @__PURE__ */ ed({});
var SQRT_M1 = ED25519_SQRT_M1;
var SQRT_AD_MINUS_ONE = /* @__PURE__ */ BigInt("25063068953384623474111414158702152701244531502492656460079210482610430750235");
var INVSQRT_A_MINUS_D = /* @__PURE__ */ BigInt("54469307008909316920995813868745141605393597292927456921205312896311721017578");
var ONE_MINUS_D_SQ = /* @__PURE__ */ BigInt("1159843021668779879193775521855586647937357759715417654439879720876111806838");
var D_MINUS_ONE_SQ = /* @__PURE__ */ BigInt("40440834346308536858101042469323190826248399146238708352240133220865137265952");
var invertSqrt = (number) => uvRatio(_1n5, number);
var MAX_255B = /* @__PURE__ */ BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
var bytes255ToNumberLE = (bytes) => Fp.create(bytesToNumberLE(bytes) & MAX_255B);
function calcElligatorRistrettoMap(r0) {
  const { d } = ed25519_CURVE;
  const P = ed25519_CURVE_p;
  const mod3 = (n) => Fp.create(n);
  const r = mod3(SQRT_M1 * r0 * r0);
  const Ns = mod3((r + _1n5) * ONE_MINUS_D_SQ);
  let c = BigInt(-1);
  const D3 = mod3((c - d * r) * mod3(r + d));
  let { isValid: Ns_D_is_sq, value: s } = uvRatio(Ns, D3);
  let s_ = mod3(s * r0);
  if (!isNegativeLE(s_, P))
    s_ = mod3(-s_);
  if (!Ns_D_is_sq)
    s = s_;
  if (!Ns_D_is_sq)
    c = r;
  const Nt = mod3(c * (r - _1n5) * D_MINUS_ONE_SQ - D3);
  const s2 = s * s;
  const W0 = mod3((s + s) * D3);
  const W1 = mod3(Nt * SQRT_AD_MINUS_ONE);
  const W2 = mod3(_1n5 - s2);
  const W3 = mod3(_1n5 + s2);
  return new ed25519_Point(mod3(W0 * W3), mod3(W2 * W1), mod3(W1 * W3), mod3(W0 * W2));
}
var _RistrettoPoint = class __RistrettoPoint extends PrimeEdwardsPoint {
  // Do NOT change syntax: the following gymnastics is done,
  // because typescript strips comments, which makes bundlers disable tree-shaking.
  // prettier-ignore
  static BASE = /* @__PURE__ */ (() => new __RistrettoPoint(ed25519_Point.BASE))();
  // prettier-ignore
  static ZERO = /* @__PURE__ */ (() => new __RistrettoPoint(ed25519_Point.ZERO))();
  // prettier-ignore
  static Fp = /* @__PURE__ */ (() => Fp)();
  // prettier-ignore
  static Fn = /* @__PURE__ */ (() => Fn)();
  constructor(ep) {
    super(ep);
  }
  /**
   * Create one Ristretto255 point from affine Edwards coordinates.
   * This wraps the internal Edwards representative directly and is not a
   * canonical ristretto255 decoding path.
   * Use `toBytes()` / `fromBytes()` if canonical ristretto255 bytes matter.
   */
  static fromAffine(ap) {
    return new __RistrettoPoint(ed25519_Point.fromAffine(ap));
  }
  assertSame(other) {
    if (!(other instanceof __RistrettoPoint))
      throw new Error("RistrettoPoint expected");
  }
  init(ep) {
    return new __RistrettoPoint(ep);
  }
  static fromBytes(bytes) {
    abytes(bytes, 32);
    const { a, d } = ed25519_CURVE;
    const P = ed25519_CURVE_p;
    const mod3 = (n) => Fp.create(n);
    const s = bytes255ToNumberLE(bytes);
    if (!equalBytes(Fp.toBytes(s), bytes) || isNegativeLE(s, P))
      throw new Error("invalid ristretto255 encoding 1");
    const s2 = mod3(s * s);
    const u1 = mod3(_1n5 + a * s2);
    const u2 = mod3(_1n5 - a * s2);
    const u1_2 = mod3(u1 * u1);
    const u2_2 = mod3(u2 * u2);
    const v = mod3(a * d * u1_2 - u2_2);
    const { isValid, value: I } = invertSqrt(mod3(v * u2_2));
    const Dx = mod3(I * u2);
    const Dy = mod3(I * Dx * v);
    let x = mod3((s + s) * Dx);
    if (isNegativeLE(x, P))
      x = mod3(-x);
    const y = mod3(u1 * Dy);
    const t = mod3(x * y);
    if (!isValid || isNegativeLE(t, P) || y === _0n5)
      throw new Error("invalid ristretto255 encoding 2");
    return new __RistrettoPoint(new ed25519_Point(x, y, _1n5, t));
  }
  /**
   * Converts ristretto-encoded string to ristretto point.
   * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-decode).
   * @param hex - Ristretto-encoded 32 bytes. Not every 32-byte string is valid ristretto encoding
   */
  static fromHex(hex) {
    return __RistrettoPoint.fromBytes(hexToBytes(hex));
  }
  /**
   * Encodes ristretto point to Uint8Array.
   * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-encode).
   */
  toBytes() {
    let { X, Y, Z, T } = this.ep;
    const P = ed25519_CURVE_p;
    const mod3 = (n) => Fp.create(n);
    const u1 = mod3(mod3(Z + Y) * mod3(Z - Y));
    const u2 = mod3(X * Y);
    const u2sq = mod3(u2 * u2);
    const { value: invsqrt } = invertSqrt(mod3(u1 * u2sq));
    const D1 = mod3(invsqrt * u1);
    const D22 = mod3(invsqrt * u2);
    const zInv = mod3(D1 * D22 * T);
    let D3;
    if (isNegativeLE(T * zInv, P)) {
      let _x = mod3(Y * SQRT_M1);
      let _y = mod3(X * SQRT_M1);
      X = _x;
      Y = _y;
      D3 = mod3(D1 * INVSQRT_A_MINUS_D);
    } else {
      D3 = D22;
    }
    if (isNegativeLE(X * zInv, P))
      Y = mod3(-Y);
    let s = mod3((Z - Y) * D3);
    if (isNegativeLE(s, P))
      s = mod3(-s);
    return Fp.toBytes(s);
  }
  /**
   * Compares two Ristretto points.
   * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-equals).
   */
  equals(other) {
    this.assertSame(other);
    const { X: X1, Y: Y1 } = this.ep;
    const { X: X2, Y: Y2 } = other.ep;
    const mod3 = (n) => Fp.create(n);
    const one = mod3(X1 * Y2) === mod3(Y1 * X2);
    const two = mod3(Y1 * Y2) === mod3(X1 * X2);
    return one || two;
  }
  is0() {
    return this.equals(__RistrettoPoint.ZERO);
  }
};
Object.freeze(_RistrettoPoint.BASE);
Object.freeze(_RistrettoPoint.ZERO);
Object.freeze(_RistrettoPoint.prototype);
Object.freeze(_RistrettoPoint);
var ristretto255_hasher = Object.freeze({
  Point: _RistrettoPoint,
  /**
  * Spec: https://www.rfc-editor.org/rfc/rfc9380.html#name-hashing-to-ristretto255. Caveats:
  * * There are no test vectors
  * * encodeToCurve / mapToCurve is undefined
  * * mapToCurve would be `calcElligatorRistrettoMap(scalars[0])`, not ristretto255_map!
  * * hashToScalar is undefined too, so we just use OPRF implementation
  * * We cannot re-use 'createHasher', because ristretto255_map is different algorithm/RFC
    (os2ip -> bytes255ToNumberLE)
  * * mapToCurve == calcElligatorRistrettoMap, hashToCurve == ristretto255_map
  * * hashToScalar is undefined in RFC9380 for ristretto, so we use the OPRF
    version here. Using `bytes255ToNumblerLE` will create a different result
    if we use `bytes255ToNumberLE` as os2ip
  * * current version is closest to spec.
  */
  hashToCurve(msg, options) {
    const DST = options?.DST === void 0 ? "ristretto255_XMD:SHA-512_R255MAP_RO_" : options.DST;
    const xmd = expand_message_xmd(msg, DST, 64, sha512);
    return ristretto255_hasher.deriveToCurve(xmd);
  },
  hashToScalar(msg, options = { DST: _DST_scalar }) {
    const xmd = expand_message_xmd(msg, options.DST, 64, sha512);
    return Fn.create(bytesToNumberLE(xmd));
  },
  /**
   * HashToCurve-like construction based on RFC 9496 (Element Derivation).
   * Converts 64 uniform random bytes into a curve point.
   *
   * WARNING: This represents an older hash-to-curve construction from before
   * RFC 9380 was finalized.
   * It was later reused as a component in the newer
   * `hash_to_ristretto255` function defined in RFC 9380.
   */
  deriveToCurve(bytes) {
    abytes(bytes, 64);
    const r1 = bytes255ToNumberLE(bytes.subarray(0, 32));
    const R1 = calcElligatorRistrettoMap(r1);
    const r2 = bytes255ToNumberLE(bytes.subarray(32, 64));
    const R2 = calcElligatorRistrettoMap(r2);
    return new _RistrettoPoint(R1.add(R2));
  }
});

// node_modules/.pnpm/@scure+base@2.2.0/node_modules/@scure/base/index.js
function isBytes3(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
function abytes3(b) {
  if (!isBytes3(b))
    throw new TypeError("Uint8Array expected");
}
function isArrayOf(isString, arr) {
  if (!Array.isArray(arr))
    return false;
  if (arr.length === 0)
    return true;
  if (isString) {
    return arr.every((item) => typeof item === "string");
  } else {
    return arr.every((item) => Number.isSafeInteger(item));
  }
}
function astr(label, input) {
  if (typeof input !== "string")
    throw new TypeError(`${label}: string expected`);
  return true;
}
function anumber3(n) {
  if (typeof n !== "number")
    throw new TypeError(`number expected, got ${typeof n}`);
  if (!Number.isSafeInteger(n))
    throw new RangeError(`invalid integer: ${n}`);
}
function aArr(input) {
  if (!Array.isArray(input))
    throw new TypeError("array expected");
}
function astrArr(label, input) {
  if (!isArrayOf(true, input))
    throw new TypeError(`${label}: array of strings expected`);
}
function anumArr(label, input) {
  if (!isArrayOf(false, input))
    throw new TypeError(`${label}: array of numbers expected`);
}
// @__NO_SIDE_EFFECTS__
function chain(...args) {
  const id2 = (a) => a;
  const wrap = (a, b) => (c) => a(b(c));
  const encode = args.map((x) => x.encode).reduceRight(wrap, id2);
  const decode = args.map((x) => x.decode).reduce(wrap, id2);
  return { encode, decode };
}
// @__NO_SIDE_EFFECTS__
function alphabet(letters) {
  const lettersA = typeof letters === "string" ? letters.split("") : letters;
  const len = lettersA.length;
  astrArr("alphabet", lettersA);
  const indexes = new Map(lettersA.map((l, i) => [l, i]));
  return {
    encode: (digits) => {
      aArr(digits);
      return digits.map((i) => {
        if (!Number.isSafeInteger(i) || i < 0 || i >= len)
          throw new Error(`alphabet.encode: digit index outside alphabet "${i}". Allowed: ${letters}`);
        return lettersA[i];
      });
    },
    decode: (input) => {
      aArr(input);
      return input.map((letter) => {
        astr("alphabet.decode", letter);
        const i = indexes.get(letter);
        if (i === void 0)
          throw new Error(`Unknown letter: "${letter}". Allowed: ${letters}`);
        return i;
      });
    }
  };
}
// @__NO_SIDE_EFFECTS__
function join2(separator = "") {
  astr("join", separator);
  return {
    encode: (from) => {
      astrArr("join.decode", from);
      return from.join(separator);
    },
    decode: (to) => {
      astr("join.decode", to);
      return to.split(separator);
    }
  };
}
// @__NO_SIDE_EFFECTS__
function padding(bits, chr = "=") {
  anumber3(bits);
  astr("padding", chr);
  return {
    encode(data) {
      astrArr("padding.encode", data);
      while (data.length * bits % 8)
        data.push(chr);
      return data;
    },
    decode(input) {
      astrArr("padding.decode", input);
      let end = input.length;
      if (end * bits % 8)
        throw new Error("padding: invalid, string should have whole number of bytes");
      for (; end > 0 && input[end - 1] === chr; end--) {
        const last = end - 1;
        const byte = last * bits;
        if (byte % 8 === 0)
          throw new Error("padding: invalid, string has too much padding");
      }
      return input.slice(0, end);
    }
  };
}
function convertRadix(data, from, to) {
  if (from < 2)
    throw new RangeError(`convertRadix: invalid from=${from}, base cannot be less than 2`);
  if (to < 2)
    throw new RangeError(`convertRadix: invalid to=${to}, base cannot be less than 2`);
  aArr(data);
  if (!data.length)
    return [];
  let pos = 0;
  const res = [];
  const digits = Array.from(data, (d) => {
    anumber3(d);
    if (d < 0 || d >= from)
      throw new Error(`invalid integer: ${d}`);
    return d;
  });
  const dlen = digits.length;
  while (true) {
    let carry = 0;
    let done = true;
    for (let i = pos; i < dlen; i++) {
      const digit = digits[i];
      const fromCarry = from * carry;
      const digitBase = fromCarry + digit;
      if (!Number.isSafeInteger(digitBase) || fromCarry / from !== carry || digitBase - digit !== fromCarry) {
        throw new Error("convertRadix: carry overflow");
      }
      const div = digitBase / to;
      carry = digitBase % to;
      const rounded = Math.floor(div);
      digits[i] = rounded;
      if (!Number.isSafeInteger(rounded) || rounded * to + carry !== digitBase)
        throw new Error("convertRadix: carry overflow");
      if (!done)
        continue;
      else if (!rounded)
        pos = i;
      else
        done = false;
    }
    res.push(carry);
    if (done)
      break;
  }
  for (let i = 0; i < data.length - 1 && data[i] === 0; i++)
    res.push(0);
  return res.reverse();
}
var gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
var radix2carry = /* @__NO_SIDE_EFFECTS__ */ (from, to) => from + (to - gcd(from, to));
var powers = /* @__PURE__ */ (() => {
  let res = [];
  for (let i = 0; i < 40; i++)
    res.push(2 ** i);
  return res;
})();
function convertRadix2(data, from, to, padding2) {
  aArr(data);
  if (from <= 0 || from > 32)
    throw new RangeError(`convertRadix2: wrong from=${from}`);
  if (to <= 0 || to > 32)
    throw new RangeError(`convertRadix2: wrong to=${to}`);
  if (/* @__PURE__ */ radix2carry(from, to) > 32) {
    throw new Error(`convertRadix2: carry overflow from=${from} to=${to} carryBits=${/* @__PURE__ */ radix2carry(from, to)}`);
  }
  let carry = 0;
  let pos = 0;
  const max = powers[from];
  const mask = powers[to] - 1;
  const res = [];
  for (const n of data) {
    anumber3(n);
    if (n >= max)
      throw new Error(`convertRadix2: invalid data word=${n} from=${from}`);
    carry = carry << from | n;
    if (pos + from > 32)
      throw new Error(`convertRadix2: carry overflow pos=${pos} from=${from}`);
    pos += from;
    for (; pos >= to; pos -= to)
      res.push((carry >> pos - to & mask) >>> 0);
    const pow = powers[pos];
    if (pow === void 0)
      throw new Error("invalid carry");
    carry &= pow - 1;
  }
  carry = carry << to - pos & mask;
  if (!padding2 && pos >= from)
    throw new Error("Excess padding");
  if (!padding2 && carry > 0)
    throw new Error(`Non-zero padding: ${carry}`);
  if (padding2 && pos > 0)
    res.push(carry >>> 0);
  return res;
}
// @__NO_SIDE_EFFECTS__
function radix(num) {
  anumber3(num);
  const _256 = 2 ** 8;
  return {
    encode: (bytes) => {
      if (!isBytes3(bytes))
        throw new TypeError("radix.encode input should be Uint8Array");
      return convertRadix(Array.from(bytes), _256, num);
    },
    decode: (digits) => {
      anumArr("radix.decode", digits);
      return Uint8Array.from(convertRadix(digits, num, _256));
    }
  };
}
// @__NO_SIDE_EFFECTS__
function radix2(bits, revPadding = false) {
  anumber3(bits);
  if (bits <= 0 || bits > 32)
    throw new RangeError("radix2: bits should be in (0..32]");
  if (/* @__PURE__ */ radix2carry(8, bits) > 32 || /* @__PURE__ */ radix2carry(bits, 8) > 32)
    throw new RangeError("radix2: carry overflow");
  return {
    encode: (bytes) => {
      if (!isBytes3(bytes))
        throw new TypeError("radix2.encode input should be Uint8Array");
      return convertRadix2(Array.from(bytes), 8, bits, !revPadding);
    },
    decode: (digits) => {
      anumArr("radix2.decode", digits);
      return Uint8Array.from(convertRadix2(digits, bits, 8, revPadding));
    }
  };
}
var hasBase64Builtin = /* @__PURE__ */ (() => typeof Uint8Array.from([]).toBase64 === "function" && typeof Uint8Array.fromBase64 === "function")();
var ASCII_WHITESPACE = /[\t\n\f\r ]/;
var decodeBase64Builtin = (s, isUrl) => {
  astr("base64", s);
  const alphabet2 = isUrl ? "base64url" : "base64";
  if (s.length > 0 && ASCII_WHITESPACE.test(s))
    throw new Error("invalid base64");
  return Uint8Array.fromBase64(s, { alphabet: alphabet2, lastChunkHandling: "strict" });
};
var base64 = /* @__PURE__ */ Object.freeze(hasBase64Builtin ? {
  encode(b) {
    abytes3(b);
    return b.toBase64();
  },
  decode(s) {
    return decodeBase64Builtin(s, false);
  }
} : /* @__PURE__ */ chain(/* @__PURE__ */ radix2(6), /* @__PURE__ */ alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"), /* @__PURE__ */ padding(6), /* @__PURE__ */ join2("")));
var genBase58 = /* @__NO_SIDE_EFFECTS__ */ (abc) => /* @__PURE__ */ chain(/* @__PURE__ */ radix(58), /* @__PURE__ */ alphabet(abc), /* @__PURE__ */ join2(""));
var base58 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ genBase58("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"));

// node_modules/.pnpm/@noble+hashes@2.2.0/node_modules/@noble/hashes/hmac.js
var _HMAC = class {
  oHash;
  iHash;
  blockLen;
  outputLen;
  canXOF = false;
  finished = false;
  destroyed = false;
  constructor(hash, key) {
    ahash(hash);
    abytes(key, void 0, "key");
    this.iHash = hash.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash.create();
    for (let i = 0; i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    clean(pad);
  }
  update(buf) {
    aexists(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const buf = out.subarray(0, this.outputLen);
    this.iHash.digestInto(buf);
    this.oHash.update(buf);
    this.oHash.digestInto(buf);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to ||= Object.create(Object.getPrototypeOf(this), {});
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
};
var hmac = /* @__PURE__ */ (() => {
  const hmac_ = ((hash, key, message) => new _HMAC(hash, key).update(message).digest());
  hmac_.create = (hash, key) => new _HMAC(hash, key);
  return hmac_;
})();

// node_modules/.pnpm/@noble+curves@2.2.0/node_modules/@noble/curves/abstract/weierstrass.js
var divNearest = (num, den) => (num + (num >= 0 ? den : -den) / _2n4) / den;
function _splitEndoScalar(k, basis, n) {
  aInRange("scalar", k, _0n6, n);
  const [[a1, b1], [a2, b2]] = basis;
  const c1 = divNearest(b2 * k, n);
  const c2 = divNearest(-b1 * k, n);
  let k1 = k - c1 * a1 - c2 * a2;
  let k2 = -c1 * b1 - c2 * b2;
  const k1neg = k1 < _0n6;
  const k2neg = k2 < _0n6;
  if (k1neg)
    k1 = -k1;
  if (k2neg)
    k2 = -k2;
  const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n6;
  if (k1 < _0n6 || k1 >= MAX_NUM || k2 < _0n6 || k2 >= MAX_NUM) {
    throw new Error("splitScalar (endomorphism): failed for k");
  }
  return { k1neg, k1, k2neg, k2 };
}
function validateSigFormat(format) {
  if (!["compact", "recovered", "der"].includes(format))
    throw new Error('Signature format must be "compact", "recovered", or "der"');
  return format;
}
function validateSigOpts(opts, def) {
  validateObject(opts);
  const optsn = {};
  for (let optName of Object.keys(def)) {
    optsn[optName] = opts[optName] === void 0 ? def[optName] : opts[optName];
  }
  abool(optsn.lowS, "lowS");
  abool(optsn.prehash, "prehash");
  if (optsn.format !== void 0)
    validateSigFormat(optsn.format);
  return optsn;
}
var DERErr = class extends Error {
  constructor(m = "") {
    super(m);
  }
};
var DER = {
  // asn.1 DER encoding utils
  Err: DERErr,
  // Basic building block is TLV (Tag-Length-Value)
  _tlv: {
    encode: (tag, data) => {
      const { Err: E } = DER;
      asafenumber(tag, "tag");
      if (tag < 0 || tag > 255)
        throw new E("tlv.encode: wrong tag");
      if (typeof data !== "string")
        throw new TypeError('"data" expected string, got type=' + typeof data);
      if (data.length & 1)
        throw new E("tlv.encode: unpadded data");
      const dataLen = data.length / 2;
      const len = numberToHexUnpadded(dataLen);
      if (len.length / 2 & 128)
        throw new E("tlv.encode: long form length too big");
      const lenLen = dataLen > 127 ? numberToHexUnpadded(len.length / 2 | 128) : "";
      const t = numberToHexUnpadded(tag);
      return t + lenLen + len + data;
    },
    // v - value, l - left bytes (unparsed)
    decode(tag, data) {
      const { Err: E } = DER;
      data = abytes2(data, void 0, "DER data");
      let pos = 0;
      if (tag < 0 || tag > 255)
        throw new E("tlv.encode: wrong tag");
      if (data.length < 2 || data[pos++] !== tag)
        throw new E("tlv.decode: wrong tlv");
      const first = data[pos++];
      const isLong = !!(first & 128);
      let length = 0;
      if (!isLong)
        length = first;
      else {
        const lenLen = first & 127;
        if (!lenLen)
          throw new E("tlv.decode(long): indefinite length not supported");
        if (lenLen > 4)
          throw new E("tlv.decode(long): byte length is too big");
        const lengthBytes = data.subarray(pos, pos + lenLen);
        if (lengthBytes.length !== lenLen)
          throw new E("tlv.decode: length bytes not complete");
        if (lengthBytes[0] === 0)
          throw new E("tlv.decode(long): zero leftmost byte");
        for (const b of lengthBytes)
          length = length << 8 | b;
        pos += lenLen;
        if (length < 128)
          throw new E("tlv.decode(long): not minimal encoding");
      }
      const v = data.subarray(pos, pos + length);
      if (v.length !== length)
        throw new E("tlv.decode: wrong value length");
      return { v, l: data.subarray(pos + length) };
    }
  },
  // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
  // since we always use positive integers here. It must always be empty:
  // - add zero byte if exists
  // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
  _int: {
    encode(num) {
      const { Err: E } = DER;
      abignumber(num);
      if (num < _0n6)
        throw new E("integer: negative integers are not allowed");
      let hex = numberToHexUnpadded(num);
      if (Number.parseInt(hex[0], 16) & 8)
        hex = "00" + hex;
      if (hex.length & 1)
        throw new E("unexpected DER parsing assertion: unpadded hex");
      return hex;
    },
    decode(data) {
      const { Err: E } = DER;
      if (data.length < 1)
        throw new E("invalid signature integer: empty");
      if (data[0] & 128)
        throw new E("invalid signature integer: negative");
      if (data.length > 1 && data[0] === 0 && !(data[1] & 128))
        throw new E("invalid signature integer: unnecessary leading zero");
      return bytesToNumberBE(data);
    }
  },
  toSig(bytes) {
    const { Err: E, _int: int, _tlv: tlv } = DER;
    const data = abytes2(bytes, void 0, "signature");
    const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
    if (seqLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
    const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
    if (sLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    return { r: int.decode(rBytes), s: int.decode(sBytes) };
  },
  hexFromSig(sig) {
    const { _tlv: tlv, _int: int } = DER;
    const rs = tlv.encode(2, int.encode(sig.r));
    const ss = tlv.encode(2, int.encode(sig.s));
    const seq = rs + ss;
    return tlv.encode(48, seq);
  }
};
Object.freeze(DER._tlv);
Object.freeze(DER._int);
Object.freeze(DER);
var _0n6 = /* @__PURE__ */ BigInt(0);
var _1n6 = /* @__PURE__ */ BigInt(1);
var _2n4 = /* @__PURE__ */ BigInt(2);
var _3n2 = /* @__PURE__ */ BigInt(3);
var _4n2 = /* @__PURE__ */ BigInt(4);
function weierstrass(params, extraOpts = {}) {
  const validated = createCurveFields("weierstrass", params, extraOpts);
  const Fp2 = validated.Fp;
  const Fn2 = validated.Fn;
  let CURVE = validated.CURVE;
  const { h: cofactor, n: CURVE_ORDER } = CURVE;
  validateObject(extraOpts, {}, {
    allowInfinityPoint: "boolean",
    clearCofactor: "function",
    isTorsionFree: "function",
    fromBytes: "function",
    toBytes: "function",
    endo: "object"
  });
  const { endo, allowInfinityPoint } = extraOpts;
  if (endo) {
    if (!Fp2.is0(CURVE.a) || typeof endo.beta !== "bigint" || !Array.isArray(endo.basises)) {
      throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    }
  }
  const lengths = getWLengths(Fp2, Fn2);
  function assertCompressionIsSupported() {
    if (!Fp2.isOdd)
      throw new Error("compression is not supported: Field does not have .isOdd()");
  }
  function pointToBytes(_c, point, isCompressed) {
    if (allowInfinityPoint && point.is0())
      return Uint8Array.of(0);
    const { x, y } = point.toAffine();
    const bx = Fp2.toBytes(x);
    abool(isCompressed, "isCompressed");
    if (isCompressed) {
      assertCompressionIsSupported();
      const hasEvenY = !Fp2.isOdd(y);
      return concatBytes2(pprefix(hasEvenY), bx);
    } else {
      return concatBytes2(Uint8Array.of(4), bx, Fp2.toBytes(y));
    }
  }
  function pointFromBytes(bytes) {
    abytes2(bytes, void 0, "Point");
    const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
    const length = bytes.length;
    const head = bytes[0];
    const tail = bytes.subarray(1);
    if (allowInfinityPoint && length === 1 && head === 0)
      return { x: Fp2.ZERO, y: Fp2.ZERO };
    if (length === comp && (head === 2 || head === 3)) {
      const x = Fp2.fromBytes(tail);
      if (!Fp2.isValid(x))
        throw new Error("bad point: is not on curve, wrong x");
      const y2 = weierstrassEquation(x);
      let y;
      try {
        y = Fp2.sqrt(y2);
      } catch (sqrtError) {
        const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
        throw new Error("bad point: is not on curve, sqrt error" + err);
      }
      assertCompressionIsSupported();
      const evenY = Fp2.isOdd(y);
      const evenH = (head & 1) === 1;
      if (evenH !== evenY)
        y = Fp2.neg(y);
      return { x, y };
    } else if (length === uncomp && head === 4) {
      const L2 = Fp2.BYTES;
      const x = Fp2.fromBytes(tail.subarray(0, L2));
      const y = Fp2.fromBytes(tail.subarray(L2, L2 * 2));
      if (!isValidXY(x, y))
        throw new Error("bad point: is not on curve");
      return { x, y };
    } else {
      throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
    }
  }
  const encodePoint = extraOpts.toBytes === void 0 ? pointToBytes : extraOpts.toBytes;
  const decodePoint = extraOpts.fromBytes === void 0 ? pointFromBytes : extraOpts.fromBytes;
  function weierstrassEquation(x) {
    const x2 = Fp2.sqr(x);
    const x3 = Fp2.mul(x2, x);
    return Fp2.add(Fp2.add(x3, Fp2.mul(x, CURVE.a)), CURVE.b);
  }
  function isValidXY(x, y) {
    const left = Fp2.sqr(y);
    const right = weierstrassEquation(x);
    return Fp2.eql(left, right);
  }
  if (!isValidXY(CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const _4a3 = Fp2.mul(Fp2.pow(CURVE.a, _3n2), _4n2);
  const _27b2 = Fp2.mul(Fp2.sqr(CURVE.b), BigInt(27));
  if (Fp2.is0(Fp2.add(_4a3, _27b2)))
    throw new Error("bad curve params: a or b");
  function acoord(title, n, banZero = false) {
    if (!Fp2.isValid(n) || banZero && Fp2.is0(n))
      throw new Error(`bad point coordinate ${title}`);
    return n;
  }
  function aprjpoint(other) {
    if (!(other instanceof Point))
      throw new Error("Weierstrass Point expected");
  }
  function splitEndoScalarN(k) {
    if (!endo || !endo.basises)
      throw new Error("no endo");
    return _splitEndoScalar(k, endo.basises, Fn2.ORDER);
  }
  function finishEndo(endoBeta, k1p, k2p, k1neg, k2neg) {
    k2p = new Point(Fp2.mul(k2p.X, endoBeta), k2p.Y, k2p.Z);
    k1p = negateCt(k1neg, k1p);
    k2p = negateCt(k2neg, k2p);
    return k1p.add(k2p);
  }
  class Point {
    // base / generator point
    static BASE = new Point(CURVE.Gx, CURVE.Gy, Fp2.ONE);
    // zero / infinity / identity point
    static ZERO = new Point(Fp2.ZERO, Fp2.ONE, Fp2.ZERO);
    // 0, 1, 0
    // math field
    static Fp = Fp2;
    // scalar field
    static Fn = Fn2;
    X;
    Y;
    Z;
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    constructor(X, Y, Z) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y, true);
      this.Z = acoord("z", Z);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp2.isValid(x) || !Fp2.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof Point)
        throw new Error("projective point not allowed");
      if (Fp2.is0(x) && Fp2.is0(y))
        return Point.ZERO;
      return new Point(x, y, Fp2.ONE);
    }
    static fromBytes(bytes) {
      const P = Point.fromAffine(decodePoint(abytes2(bytes, void 0, "point")));
      P.assertValidity();
      return P;
    }
    static fromHex(hex) {
      return Point.fromBytes(hexToBytes2(hex));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     *
     * @param windowSize
     * @param isLazy - true will defer table computation until the first multiplication
     * @returns
     */
    precompute(windowSize = 8, isLazy = true) {
      wnaf.createCache(this, windowSize);
      if (!isLazy)
        this.multiply(_3n2);
      return this;
    }
    // TODO: return `this`
    /** A point on curve is valid if it conforms to equation. */
    assertValidity() {
      const p = this;
      if (p.is0()) {
        if (extraOpts.allowInfinityPoint && Fp2.is0(p.X) && Fp2.eql(p.Y, Fp2.ONE) && Fp2.is0(p.Z))
          return;
        throw new Error("bad point: ZERO");
      }
      const { x, y } = p.toAffine();
      if (!Fp2.isValid(x) || !Fp2.isValid(y))
        throw new Error("bad point: x or y not field elements");
      if (!isValidXY(x, y))
        throw new Error("bad point: equation left != right");
      if (!p.isTorsionFree())
        throw new Error("bad point: not in prime-order subgroup");
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (!Fp2.isOdd)
        throw new Error("Field doesn't support isOdd");
      return !Fp2.isOdd(y);
    }
    /** Compare one point to another. */
    equals(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const U1 = Fp2.eql(Fp2.mul(X1, Z2), Fp2.mul(X2, Z1));
      const U2 = Fp2.eql(Fp2.mul(Y1, Z2), Fp2.mul(Y2, Z1));
      return U1 && U2;
    }
    /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
    negate() {
      return new Point(this.X, Fp2.neg(this.Y), this.Z);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { a, b } = CURVE;
      const b3 = Fp2.mul(b, _3n2);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      let X3 = Fp2.ZERO, Y3 = Fp2.ZERO, Z3 = Fp2.ZERO;
      let t0 = Fp2.mul(X1, X1);
      let t1 = Fp2.mul(Y1, Y1);
      let t2 = Fp2.mul(Z1, Z1);
      let t3 = Fp2.mul(X1, Y1);
      t3 = Fp2.add(t3, t3);
      Z3 = Fp2.mul(X1, Z1);
      Z3 = Fp2.add(Z3, Z3);
      X3 = Fp2.mul(a, Z3);
      Y3 = Fp2.mul(b3, t2);
      Y3 = Fp2.add(X3, Y3);
      X3 = Fp2.sub(t1, Y3);
      Y3 = Fp2.add(t1, Y3);
      Y3 = Fp2.mul(X3, Y3);
      X3 = Fp2.mul(t3, X3);
      Z3 = Fp2.mul(b3, Z3);
      t2 = Fp2.mul(a, t2);
      t3 = Fp2.sub(t0, t2);
      t3 = Fp2.mul(a, t3);
      t3 = Fp2.add(t3, Z3);
      Z3 = Fp2.add(t0, t0);
      t0 = Fp2.add(Z3, t0);
      t0 = Fp2.add(t0, t2);
      t0 = Fp2.mul(t0, t3);
      Y3 = Fp2.add(Y3, t0);
      t2 = Fp2.mul(Y1, Z1);
      t2 = Fp2.add(t2, t2);
      t0 = Fp2.mul(t2, t3);
      X3 = Fp2.sub(X3, t0);
      Z3 = Fp2.mul(t2, t1);
      Z3 = Fp2.add(Z3, Z3);
      Z3 = Fp2.add(Z3, Z3);
      return new Point(X3, Y3, Z3);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      let X3 = Fp2.ZERO, Y3 = Fp2.ZERO, Z3 = Fp2.ZERO;
      const a = CURVE.a;
      const b3 = Fp2.mul(CURVE.b, _3n2);
      let t0 = Fp2.mul(X1, X2);
      let t1 = Fp2.mul(Y1, Y2);
      let t2 = Fp2.mul(Z1, Z2);
      let t3 = Fp2.add(X1, Y1);
      let t4 = Fp2.add(X2, Y2);
      t3 = Fp2.mul(t3, t4);
      t4 = Fp2.add(t0, t1);
      t3 = Fp2.sub(t3, t4);
      t4 = Fp2.add(X1, Z1);
      let t5 = Fp2.add(X2, Z2);
      t4 = Fp2.mul(t4, t5);
      t5 = Fp2.add(t0, t2);
      t4 = Fp2.sub(t4, t5);
      t5 = Fp2.add(Y1, Z1);
      X3 = Fp2.add(Y2, Z2);
      t5 = Fp2.mul(t5, X3);
      X3 = Fp2.add(t1, t2);
      t5 = Fp2.sub(t5, X3);
      Z3 = Fp2.mul(a, t4);
      X3 = Fp2.mul(b3, t2);
      Z3 = Fp2.add(X3, Z3);
      X3 = Fp2.sub(t1, Z3);
      Z3 = Fp2.add(t1, Z3);
      Y3 = Fp2.mul(X3, Z3);
      t1 = Fp2.add(t0, t0);
      t1 = Fp2.add(t1, t0);
      t2 = Fp2.mul(a, t2);
      t4 = Fp2.mul(b3, t4);
      t1 = Fp2.add(t1, t2);
      t2 = Fp2.sub(t0, t2);
      t2 = Fp2.mul(a, t2);
      t4 = Fp2.add(t4, t2);
      t0 = Fp2.mul(t1, t4);
      Y3 = Fp2.add(Y3, t0);
      t0 = Fp2.mul(t5, t4);
      X3 = Fp2.mul(t3, X3);
      X3 = Fp2.sub(X3, t0);
      t0 = Fp2.mul(t3, t1);
      Z3 = Fp2.mul(t5, Z3);
      Z3 = Fp2.add(Z3, t0);
      return new Point(X3, Y3, Z3);
    }
    subtract(other) {
      aprjpoint(other);
      return this.add(other.negate());
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    /**
     * Constant time multiplication.
     * Uses wNAF method. Windowed method may be 10% faster,
     * but takes 2x longer to generate and consumes 2x memory.
     * Uses precomputes when available.
     * Uses endomorphism for Koblitz curves.
     * @param scalar - by which the point would be multiplied
     * @returns New point
     */
    multiply(scalar) {
      const { endo: endo2 } = extraOpts;
      if (!Fn2.isValidNot0(scalar))
        throw new RangeError("invalid scalar: out of range");
      let point, fake;
      const mul2 = (n) => wnaf.cached(this, n, (p) => normalizeZ(Point, p));
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(scalar);
        const { p: k1p, f: k1f } = mul2(k1);
        const { p: k2p, f: k2f } = mul2(k2);
        fake = k1f.add(k2f);
        point = finishEndo(endo2.beta, k1p, k2p, k1neg, k2neg);
      } else {
        const { p, f } = mul2(scalar);
        point = p;
        fake = f;
      }
      return normalizeZ(Point, [point, fake])[0];
    }
    /**
     * Non-constant-time multiplication. Uses double-and-add algorithm.
     * It's faster, but should only be used when you don't care about
     * an exposed secret key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(scalar) {
      const { endo: endo2 } = extraOpts;
      const p = this;
      const sc = scalar;
      if (!Fn2.isValid(sc))
        throw new RangeError("invalid scalar: out of range");
      if (sc === _0n6 || p.is0())
        return Point.ZERO;
      if (sc === _1n6)
        return p;
      if (wnaf.hasCache(this))
        return this.multiply(sc);
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(sc);
        const { p1, p2 } = mulEndoUnsafe(Point, p, k1, k2);
        return finishEndo(endo2.beta, p1, p2, k1neg, k2neg);
      } else {
        return wnaf.unsafe(p, sc);
      }
    }
    /**
     * Converts Projective point to affine (x, y) coordinates.
     * (X, Y, Z) ∋ (x=X/Z, y=Y/Z).
     * @param invertedZ - Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
     */
    toAffine(invertedZ) {
      const p = this;
      let iz = invertedZ;
      const { X, Y, Z } = p;
      if (Fp2.eql(Z, Fp2.ONE))
        return { x: X, y: Y };
      const is0 = p.is0();
      if (iz == null)
        iz = is0 ? Fp2.ONE : Fp2.inv(Z);
      const x = Fp2.mul(X, iz);
      const y = Fp2.mul(Y, iz);
      const zz = Fp2.mul(Z, iz);
      if (is0)
        return { x: Fp2.ZERO, y: Fp2.ZERO };
      if (!Fp2.eql(zz, Fp2.ONE))
        throw new Error("invZ was invalid");
      return { x, y };
    }
    /**
     * Checks whether Point is free of torsion elements (is in prime subgroup).
     * Always torsion-free for cofactor=1 curves.
     */
    isTorsionFree() {
      const { isTorsionFree } = extraOpts;
      if (cofactor === _1n6)
        return true;
      if (isTorsionFree)
        return isTorsionFree(Point, this);
      return wnaf.unsafe(this, CURVE_ORDER).is0();
    }
    clearCofactor() {
      const { clearCofactor } = extraOpts;
      if (cofactor === _1n6)
        return this;
      if (clearCofactor)
        return clearCofactor(Point, this);
      return this.multiplyUnsafe(cofactor);
    }
    isSmallOrder() {
      if (cofactor === _1n6)
        return this.is0();
      return this.clearCofactor().is0();
    }
    toBytes(isCompressed = true) {
      abool(isCompressed, "isCompressed");
      this.assertValidity();
      return encodePoint(Point, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex2(this.toBytes(isCompressed));
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
  }
  const bits = Fn2.BITS;
  const wnaf = new wNAF(Point, extraOpts.endo ? Math.ceil(bits / 2) : bits);
  if (bits >= 8)
    Point.BASE.precompute(8);
  Object.freeze(Point.prototype);
  Object.freeze(Point);
  return Point;
}
function pprefix(hasEvenY) {
  return Uint8Array.of(hasEvenY ? 2 : 3);
}
function getWLengths(Fp2, Fn2) {
  return {
    secretKey: Fn2.BYTES,
    publicKey: 1 + Fp2.BYTES,
    publicKeyUncompressed: 1 + 2 * Fp2.BYTES,
    publicKeyHasPrefix: true,
    // Raw compact `(r || s)` signature width; DER and recovered signatures use
    // different lengths outside this helper.
    signature: 2 * Fn2.BYTES
  };
}
function ecdh(Point, ecdhOpts = {}) {
  const { Fn: Fn2 } = Point;
  const randomBytes_ = ecdhOpts.randomBytes === void 0 ? randomBytes2 : ecdhOpts.randomBytes;
  const lengths = Object.assign(getWLengths(Point.Fp, Fn2), {
    seed: Math.max(getMinHashLength(Fn2.ORDER), 16)
  });
  function isValidSecretKey(secretKey) {
    try {
      const num = Fn2.fromBytes(secretKey);
      return Fn2.isValidNot0(num);
    } catch (error) {
      return false;
    }
  }
  function isValidPublicKey(publicKey, isCompressed) {
    const { publicKey: comp, publicKeyUncompressed } = lengths;
    try {
      const l = publicKey.length;
      if (isCompressed === true && l !== comp)
        return false;
      if (isCompressed === false && l !== publicKeyUncompressed)
        return false;
      return !!Point.fromBytes(publicKey);
    } catch (error) {
      return false;
    }
  }
  function randomSecretKey(seed) {
    seed = seed === void 0 ? randomBytes_(lengths.seed) : seed;
    return mapHashToField(abytes2(seed, lengths.seed, "seed"), Fn2.ORDER);
  }
  function getPublicKey(secretKey, isCompressed = true) {
    return Point.BASE.multiply(Fn2.fromBytes(secretKey)).toBytes(isCompressed);
  }
  function isProbPub(item) {
    const { secretKey, publicKey, publicKeyUncompressed } = lengths;
    const allowedLengths = Fn2._lengths;
    if (!isBytes2(item))
      return void 0;
    const l = abytes2(item, void 0, "key").length;
    const isPub = l === publicKey || l === publicKeyUncompressed;
    const isSec = l === secretKey || !!allowedLengths?.includes(l);
    if (isPub && isSec)
      return void 0;
    return isPub;
  }
  function getSharedSecret(secretKeyA, publicKeyB, isCompressed = true) {
    if (isProbPub(secretKeyA) === true)
      throw new Error("first arg must be private key");
    if (isProbPub(publicKeyB) === false)
      throw new Error("second arg must be public key");
    const s = Fn2.fromBytes(secretKeyA);
    const b = Point.fromBytes(publicKeyB);
    return b.multiply(s).toBytes(isCompressed);
  }
  const utils = {
    isValidSecretKey,
    isValidPublicKey,
    randomSecretKey
  };
  const keygen = createKeygen(randomSecretKey, getPublicKey);
  Object.freeze(utils);
  Object.freeze(lengths);
  return Object.freeze({ getPublicKey, getSharedSecret, keygen, Point, utils, lengths });
}
function ecdsa(Point, hash, ecdsaOpts = {}) {
  const hash_ = hash;
  ahash(hash_);
  validateObject(ecdsaOpts, {}, {
    hmac: "function",
    lowS: "boolean",
    randomBytes: "function",
    bits2int: "function",
    bits2int_modN: "function"
  });
  ecdsaOpts = Object.assign({}, ecdsaOpts);
  const randomBytes4 = ecdsaOpts.randomBytes === void 0 ? randomBytes2 : ecdsaOpts.randomBytes;
  const hmac2 = ecdsaOpts.hmac === void 0 ? (key, msg) => hmac(hash_, key, msg) : ecdsaOpts.hmac;
  const { Fp: Fp2, Fn: Fn2 } = Point;
  const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn2;
  const { keygen, getPublicKey, getSharedSecret, utils, lengths } = ecdh(Point, ecdsaOpts);
  const defaultSigOpts = {
    prehash: true,
    lowS: typeof ecdsaOpts.lowS === "boolean" ? ecdsaOpts.lowS : true,
    format: "compact",
    extraEntropy: false
  };
  const hasLargeRecoveryLifts = CURVE_ORDER * _2n4 + _1n6 < Fp2.ORDER;
  function isBiggerThanHalfOrder(number) {
    const HALF = CURVE_ORDER >> _1n6;
    return number > HALF;
  }
  function validateRS(title, num) {
    if (!Fn2.isValidNot0(num))
      throw new Error(`invalid signature ${title}: out of range 1..Point.Fn.ORDER`);
    return num;
  }
  function assertRecoverableCurve() {
    if (hasLargeRecoveryLifts)
      throw new Error('"recovered" sig type is not supported for cofactor >2 curves');
  }
  function validateSigLength(bytes, format) {
    validateSigFormat(format);
    const size = lengths.signature;
    const sizer = format === "compact" ? size : format === "recovered" ? size + 1 : void 0;
    return abytes2(bytes, sizer);
  }
  class Signature2 {
    r;
    s;
    recovery;
    constructor(r, s, recovery) {
      this.r = validateRS("r", r);
      this.s = validateRS("s", s);
      if (recovery != null) {
        assertRecoverableCurve();
        if (![0, 1, 2, 3].includes(recovery))
          throw new Error("invalid recovery id");
        this.recovery = recovery;
      }
      Object.freeze(this);
    }
    static fromBytes(bytes, format = defaultSigOpts.format) {
      validateSigLength(bytes, format);
      let recid;
      if (format === "der") {
        const { r: r2, s: s2 } = DER.toSig(abytes2(bytes));
        return new Signature2(r2, s2);
      }
      if (format === "recovered") {
        recid = bytes[0];
        format = "compact";
        bytes = bytes.subarray(1);
      }
      const L2 = lengths.signature / 2;
      const r = bytes.subarray(0, L2);
      const s = bytes.subarray(L2, L2 * 2);
      return new Signature2(Fn2.fromBytes(r), Fn2.fromBytes(s), recid);
    }
    static fromHex(hex, format) {
      return this.fromBytes(hexToBytes2(hex), format);
    }
    assertRecovery() {
      const { recovery } = this;
      if (recovery == null)
        throw new Error("invalid recovery id: must be present");
      return recovery;
    }
    addRecoveryBit(recovery) {
      return new Signature2(this.r, this.s, recovery);
    }
    // Unlike the top-level helper below, this method expects a digest that has
    // already been hashed to the curve's message representative.
    recoverPublicKey(messageHash) {
      const { r, s } = this;
      const recovery = this.assertRecovery();
      const radj = recovery === 2 || recovery === 3 ? r + CURVE_ORDER : r;
      if (!Fp2.isValid(radj))
        throw new Error("invalid recovery id: sig.r+curve.n != R.x");
      const x = Fp2.toBytes(radj);
      const R = Point.fromBytes(concatBytes2(pprefix((recovery & 1) === 0), x));
      const ir = Fn2.inv(radj);
      const h = bits2int_modN(abytes2(messageHash, void 0, "msgHash"));
      const u1 = Fn2.create(-h * ir);
      const u2 = Fn2.create(s * ir);
      const Q3 = Point.BASE.multiplyUnsafe(u1).add(R.multiplyUnsafe(u2));
      if (Q3.is0())
        throw new Error("invalid recovery: point at infinify");
      Q3.assertValidity();
      return Q3;
    }
    // Signatures should be low-s, to prevent malleability.
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    toBytes(format = defaultSigOpts.format) {
      validateSigFormat(format);
      if (format === "der")
        return hexToBytes2(DER.hexFromSig(this));
      const { r, s } = this;
      const rb = Fn2.toBytes(r);
      const sb = Fn2.toBytes(s);
      if (format === "recovered") {
        assertRecoverableCurve();
        return concatBytes2(Uint8Array.of(this.assertRecovery()), rb, sb);
      }
      return concatBytes2(rb, sb);
    }
    toHex(format) {
      return bytesToHex2(this.toBytes(format));
    }
  }
  Object.freeze(Signature2.prototype);
  Object.freeze(Signature2);
  const bits2int = ecdsaOpts.bits2int === void 0 ? function bits2int_def(bytes) {
    if (bytes.length > 8192)
      throw new Error("input is too large");
    const num = bytesToNumberBE(bytes);
    const delta = bytes.length * 8 - fnBits;
    return delta > 0 ? num >> BigInt(delta) : num;
  } : ecdsaOpts.bits2int;
  const bits2int_modN = ecdsaOpts.bits2int_modN === void 0 ? function bits2int_modN_def(bytes) {
    return Fn2.create(bits2int(bytes));
  } : ecdsaOpts.bits2int_modN;
  const ORDER_MASK = bitMask(fnBits);
  function int2octets(num) {
    aInRange("num < 2^" + fnBits, num, _0n6, ORDER_MASK);
    return Fn2.toBytes(num);
  }
  function validateMsgAndHash(message, prehash) {
    abytes2(message, void 0, "message");
    return prehash ? abytes2(hash_(message), void 0, "prehashed message") : message;
  }
  function prepSig(message, secretKey, opts) {
    const { lowS, prehash, extraEntropy } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    const h1int = bits2int_modN(message);
    const d = Fn2.fromBytes(secretKey);
    if (!Fn2.isValidNot0(d))
      throw new Error("invalid private key");
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (extraEntropy != null && extraEntropy !== false) {
      const e = extraEntropy === true ? randomBytes4(lengths.secretKey) : extraEntropy;
      seedArgs.push(abytes2(e, void 0, "extraEntropy"));
    }
    const seed = concatBytes2(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!Fn2.isValidNot0(k))
        return;
      const ik = Fn2.inv(k);
      const q = Point.BASE.multiply(k).toAffine();
      const r = Fn2.create(q.x);
      if (r === _0n6)
        return;
      const s = Fn2.create(ik * Fn2.create(m + r * d));
      if (s === _0n6)
        return;
      let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n6);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = Fn2.neg(s);
        recovery ^= 1;
      }
      return new Signature2(r, normS, hasLargeRecoveryLifts ? void 0 : recovery);
    }
    return { seed, k2sig };
  }
  function sign(message, secretKey, opts = {}) {
    const { seed, k2sig } = prepSig(message, secretKey, opts);
    const drbg = createHmacDrbg(hash_.outputLen, Fn2.BYTES, hmac2);
    const sig = drbg(seed, k2sig);
    return sig.toBytes(opts.format);
  }
  function verify(signature, message, publicKey, opts = {}) {
    const { lowS, prehash, format } = validateSigOpts(opts, defaultSigOpts);
    publicKey = abytes2(publicKey, void 0, "publicKey");
    message = validateMsgAndHash(message, prehash);
    if (!isBytes2(signature)) {
      const end = signature instanceof Signature2 ? ", use sig.toBytes()" : "";
      throw new Error("verify expects Uint8Array signature" + end);
    }
    validateSigLength(signature, format);
    try {
      const sig = Signature2.fromBytes(signature, format);
      const P = Point.fromBytes(publicKey);
      if (lowS && sig.hasHighS())
        return false;
      const { r, s } = sig;
      const h = bits2int_modN(message);
      const is = Fn2.inv(s);
      const u1 = Fn2.create(h * is);
      const u2 = Fn2.create(r * is);
      const R = Point.BASE.multiplyUnsafe(u1).add(P.multiplyUnsafe(u2));
      if (R.is0())
        return false;
      const v = Fn2.create(R.x);
      return v === r;
    } catch (e) {
      return false;
    }
  }
  function recoverPublicKey(signature, message, opts = {}) {
    const { prehash } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    return Signature2.fromBytes(signature, "recovered").recoverPublicKey(message).toBytes();
  }
  return Object.freeze({
    keygen,
    getPublicKey,
    getSharedSecret,
    utils,
    lengths,
    Point,
    sign,
    verify,
    recoverPublicKey,
    Signature: Signature2,
    hash: hash_
  });
}

// node_modules/.pnpm/@noble+curves@2.2.0/node_modules/@noble/curves/secp256k1.js
var secp256k1_CURVE = {
  p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),
  n: BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),
  h: BigInt(1),
  a: BigInt(0),
  b: BigInt(7),
  Gx: BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"),
  Gy: BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
};
var secp256k1_ENDO = {
  beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
  basises: [
    [BigInt("0x3086d221a7d46bcde86c90e49284eb15"), -BigInt("0xe4437ed6010e88286f547fa90abfe4c3")],
    [BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), BigInt("0x3086d221a7d46bcde86c90e49284eb15")]
  ]
};
var _2n5 = /* @__PURE__ */ BigInt(2);
function sqrtMod(y) {
  const P = secp256k1_CURVE.p;
  const _3n3 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
  const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
  const b2 = y * y * y % P;
  const b3 = b2 * b2 * y % P;
  const b6 = pow2(b3, _3n3, P) * b3 % P;
  const b9 = pow2(b6, _3n3, P) * b3 % P;
  const b11 = pow2(b9, _2n5, P) * b2 % P;
  const b22 = pow2(b11, _11n, P) * b11 % P;
  const b44 = pow2(b22, _22n, P) * b22 % P;
  const b88 = pow2(b44, _44n, P) * b44 % P;
  const b176 = pow2(b88, _88n, P) * b88 % P;
  const b220 = pow2(b176, _44n, P) * b44 % P;
  const b223 = pow2(b220, _3n3, P) * b3 % P;
  const t1 = pow2(b223, _23n, P) * b22 % P;
  const t2 = pow2(t1, _6n, P) * b2 % P;
  const root = pow2(t2, _2n5, P);
  if (!Fpk1.eql(Fpk1.sqr(root), y))
    throw new Error("Cannot find square root");
  return root;
}
var Fpk1 = Field(secp256k1_CURVE.p, { sqrt: sqrtMod });
var Pointk1 = /* @__PURE__ */ weierstrass(secp256k1_CURVE, {
  Fp: Fpk1,
  endo: secp256k1_ENDO
});
var secp256k1 = /* @__PURE__ */ ecdsa(Pointk1, sha256);

// node_modules/.pnpm/@noble+hashes@2.2.0/node_modules/@noble/hashes/sha3.js
var _0n7 = BigInt(0);
var _1n7 = BigInt(1);
var _2n6 = BigInt(2);
var _7n2 = BigInt(7);
var _256n = BigInt(256);
var _0x71n = BigInt(113);
var SHA3_PI = [];
var SHA3_ROTL = [];
var _SHA3_IOTA = [];
for (let round = 0, R = _1n7, x = 1, y = 0; round < 24; round++) {
  [x, y] = [y, (2 * x + 3 * y) % 5];
  SHA3_PI.push(2 * (5 * y + x));
  SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
  let t = _0n7;
  for (let j = 0; j < 7; j++) {
    R = (R << _1n7 ^ (R >> _7n2) * _0x71n) % _256n;
    if (R & _2n6)
      t ^= _1n7 << (_1n7 << BigInt(j)) - _1n7;
  }
  _SHA3_IOTA.push(t);
}
var IOTAS = split(_SHA3_IOTA, true);
var SHA3_IOTA_H = IOTAS[0];
var SHA3_IOTA_L = IOTAS[1];
var rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
var rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
function keccakP(s, rounds = 24) {
  anumber(rounds, "rounds");
  if (rounds < 1 || rounds > 24)
    throw new Error('"rounds" expected integer 1..24');
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x = 0; x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0; y < 50; y += 10) {
      const b0 = s[y], b1 = s[y + 1], b2 = s[y + 2], b3 = s[y + 3];
      s[y] ^= ~s[y + 2] & s[y + 4];
      s[y + 1] ^= ~s[y + 3] & s[y + 5];
      s[y + 2] ^= ~s[y + 4] & s[y + 6];
      s[y + 3] ^= ~s[y + 5] & s[y + 7];
      s[y + 4] ^= ~s[y + 6] & s[y + 8];
      s[y + 5] ^= ~s[y + 7] & s[y + 9];
      s[y + 6] ^= ~s[y + 8] & b0;
      s[y + 7] ^= ~s[y + 9] & b1;
      s[y + 8] ^= ~b0 & b2;
      s[y + 9] ^= ~b1 & b3;
    }
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  clean(B);
}
var Keccak = class _Keccak {
  state;
  pos = 0;
  posOut = 0;
  finished = false;
  state32;
  destroyed = false;
  blockLen;
  suffix;
  outputLen;
  canXOF;
  enableXOF = false;
  rounds;
  // NOTE: we accept arguments in bytes instead of bits here.
  constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
    this.blockLen = blockLen;
    this.suffix = suffix;
    this.outputLen = outputLen;
    this.enableXOF = enableXOF;
    this.canXOF = enableXOF;
    this.rounds = rounds;
    anumber(outputLen, "outputLen");
    if (!(0 < blockLen && blockLen < 200))
      throw new Error("only keccak-f1600 function is supported");
    this.state = new Uint8Array(200);
    this.state32 = u32(this.state);
  }
  clone() {
    return this._cloneInto();
  }
  keccak() {
    swap32IfBE(this.state32);
    keccakP(this.state32, this.rounds);
    swap32IfBE(this.state32);
    this.posOut = 0;
    this.pos = 0;
  }
  update(data) {
    aexists(this);
    abytes(data);
    const { blockLen, state } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      for (let i = 0; i < take; i++)
        state[this.pos++] ^= data[pos++];
      if (this.pos === blockLen)
        this.keccak();
    }
    return this;
  }
  finish() {
    if (this.finished)
      return;
    this.finished = true;
    const { state, suffix, pos, blockLen } = this;
    state[pos] ^= suffix;
    if ((suffix & 128) !== 0 && pos === blockLen - 1)
      this.keccak();
    state[blockLen - 1] ^= 128;
    this.keccak();
  }
  writeInto(out) {
    aexists(this, false);
    abytes(out);
    this.finish();
    const bufferOut = this.state;
    const { blockLen } = this;
    for (let pos = 0, len = out.length; pos < len; ) {
      if (this.posOut >= blockLen)
        this.keccak();
      const take = Math.min(blockLen - this.posOut, len - pos);
      out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
      this.posOut += take;
      pos += take;
    }
    return out;
  }
  xofInto(out) {
    if (!this.enableXOF)
      throw new Error("XOF is not possible for this instance");
    return this.writeInto(out);
  }
  xof(bytes) {
    anumber(bytes);
    return this.xofInto(new Uint8Array(bytes));
  }
  digestInto(out) {
    aoutput(out, this);
    if (this.finished)
      throw new Error("digest() was already called");
    this.writeInto(out.subarray(0, this.outputLen));
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.outputLen);
    this.digestInto(out);
    return out;
  }
  destroy() {
    this.destroyed = true;
    clean(this.state);
  }
  _cloneInto(to) {
    const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
    to ||= new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds);
    to.blockLen = blockLen;
    to.state32.set(this.state32);
    to.pos = this.pos;
    to.posOut = this.posOut;
    to.finished = this.finished;
    to.rounds = rounds;
    to.suffix = suffix;
    to.outputLen = outputLen;
    to.enableXOF = enableXOF;
    to.canXOF = this.canXOF;
    to.destroyed = this.destroyed;
    return to;
  }
};
var genShake = (suffix, blockLen, outputLen, info = {}) => createHasher((opts = {}) => new Keccak(blockLen, suffix, opts.dkLen === void 0 ? outputLen : opts.dkLen, true), info);
var shake128 = /* @__PURE__ */ genShake(31, 168, 16, /* @__PURE__ */ oidNist(11));
var shake256 = /* @__PURE__ */ genShake(31, 136, 32, /* @__PURE__ */ oidNist(12));

// node_modules/.pnpm/@noble+post-quantum@0.6.1/node_modules/@noble/post-quantum/utils.js
var abytesDoc = abytes;
var randomBytes3 = randomBytes;
function equalBytes2(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
function validateOpts(opts) {
  if (Object.prototype.toString.call(opts) !== "[object Object]")
    throw new TypeError("expected valid options object");
}
function validateVerOpts(opts) {
  validateOpts(opts);
  if (opts.context !== void 0)
    abytes(opts.context, void 0, "opts.context");
}
function validateSigOpts2(opts) {
  validateVerOpts(opts);
  if (opts.extraEntropy !== false && opts.extraEntropy !== void 0)
    abytes(opts.extraEntropy, void 0, "opts.extraEntropy");
}
function splitCoder(label, ...lengths) {
  const getLength = (c) => typeof c === "number" ? c : c.bytesLen;
  const bytesLen = lengths.reduce((sum, a) => sum + getLength(a), 0);
  return {
    bytesLen,
    encode: (bufs) => {
      const res = new Uint8Array(bytesLen);
      for (let i = 0, pos = 0; i < lengths.length; i++) {
        const c = lengths[i];
        const l = getLength(c);
        const b = typeof c === "number" ? bufs[i] : c.encode(bufs[i]);
        abytes(b, l, label);
        res.set(b, pos);
        if (typeof c !== "number")
          b.fill(0);
        pos += l;
      }
      return res;
    },
    decode: (buf) => {
      abytes(buf, bytesLen, label);
      const res = [];
      for (const c of lengths) {
        const l = getLength(c);
        const b = buf.subarray(0, l);
        res.push(typeof c === "number" ? b : c.decode(b));
        buf = buf.subarray(l);
      }
      return res;
    }
  };
}
function vecCoder(c, vecLen) {
  const coder = c;
  const bytesLen = vecLen * coder.bytesLen;
  return {
    bytesLen,
    encode: (u) => {
      if (u.length !== vecLen)
        throw new RangeError(`vecCoder.encode: wrong length=${u.length}. Expected: ${vecLen}`);
      const res = new Uint8Array(bytesLen);
      for (let i = 0, pos = 0; i < u.length; i++) {
        const b = coder.encode(u[i]);
        res.set(b, pos);
        b.fill(0);
        pos += b.length;
      }
      return res;
    },
    decode: (a) => {
      abytes(a, bytesLen);
      const r = [];
      for (let i = 0; i < a.length; i += coder.bytesLen)
        r.push(coder.decode(a.subarray(i, i + coder.bytesLen)));
      return r;
    }
  };
}
function cleanBytes(...list) {
  for (const t of list) {
    if (Array.isArray(t))
      for (const b of t)
        b.fill(0);
    else
      t.fill(0);
  }
}
function getMask(bits) {
  if (!Number.isSafeInteger(bits) || bits < 0 || bits > 32)
    throw new RangeError(`expected bits in [0..32], got ${bits}`);
  return bits === 32 ? 4294967295 : ~(-1 << bits) >>> 0;
}
var EMPTY = /* @__PURE__ */ Uint8Array.of();
function getMessage(msg, ctx = EMPTY) {
  abytes(msg);
  abytes(ctx);
  if (ctx.length > 255)
    throw new RangeError("context should be 255 bytes or less");
  return concatBytes(new Uint8Array([0, ctx.length]), ctx, msg);
}
var oidNistP = /* @__PURE__ */ Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2]);
function checkHash(hash, requiredStrength = 0) {
  if (!hash.oid || !equalBytes2(hash.oid.subarray(0, 10), oidNistP))
    throw new Error("hash.oid is invalid: expected NIST hash");
  const collisionResistance = hash.outputLen * 8 / 2;
  if (requiredStrength > collisionResistance) {
    throw new Error("Pre-hash security strength too low: " + collisionResistance + ", required: " + requiredStrength);
  }
}
function getMessagePrehash(hash, msg, ctx = EMPTY) {
  abytes(msg);
  abytes(ctx);
  if (ctx.length > 255)
    throw new RangeError("context should be 255 bytes or less");
  const hashed = hash(msg);
  return concatBytes(new Uint8Array([1, ctx.length]), ctx, hash.oid, hashed);
}

// node_modules/.pnpm/@noble+post-quantum@0.6.1/node_modules/@noble/post-quantum/_crystals.js
var genCrystals = (opts) => {
  const { newPoly: newPoly2, N: N3, Q: Q3, F: F2, ROOT_OF_UNITY: ROOT_OF_UNITY2, brvBits, isKyber } = opts;
  const mod3 = (a, modulo = Q3) => {
    const result = a % modulo | 0;
    return (result >= 0 ? result | 0 : modulo + result | 0) | 0;
  };
  const smod = (a, modulo = Q3) => {
    const r = mod3(a, modulo) | 0;
    return (r > modulo >> 1 ? r - modulo | 0 : r) | 0;
  };
  function getZettas() {
    const out = newPoly2(N3);
    for (let i = 0; i < N3; i++) {
      const b = reverseBits(i, brvBits);
      const p = BigInt(ROOT_OF_UNITY2) ** BigInt(b) % BigInt(Q3);
      out[i] = Number(p) | 0;
    }
    return out;
  }
  const nttZetas = getZettas();
  const field = {
    add: (a, b) => mod3((a | 0) + (b | 0)) | 0,
    sub: (a, b) => mod3((a | 0) - (b | 0)) | 0,
    mul: (a, b) => mod3((a | 0) * (b | 0)) | 0,
    inv: (_a) => {
      throw new Error("not implemented");
    }
  };
  const nttOpts = {
    N: N3,
    roots: nttZetas,
    invertButterflies: true,
    skipStages: isKyber ? 1 : 0,
    brp: false
  };
  const dif = FFTCore(field, { dit: false, ...nttOpts });
  const dit = FFTCore(field, { dit: true, ...nttOpts });
  const NTT = {
    encode: (r) => {
      return dif(r);
    },
    decode: (r) => {
      dit(r);
      for (let i = 0; i < r.length; i++)
        r[i] = mod3(F2 * r[i]);
      return r;
    }
  };
  const bitsCoder = (d, c) => {
    const mask = getMask(d);
    const bytesLen = d * (N3 / 8);
    return {
      bytesLen,
      encode: (poly_) => {
        const poly = poly_;
        const r = new Uint8Array(bytesLen);
        for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < poly.length; i++) {
          buf |= (c.encode(poly[i]) & mask) << bufLen;
          bufLen += d;
          for (; bufLen >= 8; bufLen -= 8, buf >>= 8)
            r[pos++] = buf & getMask(bufLen);
        }
        return r;
      },
      decode: (bytes) => {
        const r = newPoly2(N3);
        for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < bytes.length; i++) {
          buf |= bytes[i] << bufLen;
          bufLen += 8;
          for (; bufLen >= d; bufLen -= d, buf >>= d)
            r[pos++] = c.decode(buf & mask);
        }
        return r;
      }
    };
  };
  return {
    mod: mod3,
    smod,
    nttZetas,
    NTT: {
      encode: (r) => NTT.encode(r),
      decode: (r) => NTT.decode(r)
    },
    bitsCoder
  };
};
var createXofShake = (shake) => (seed, blockLen) => {
  if (!blockLen)
    blockLen = shake.blockLen;
  const _seed = new Uint8Array(seed.length + 2);
  _seed.set(seed);
  const seedLen = seed.length;
  const buf = new Uint8Array(blockLen);
  let h = shake.create({});
  let calls = 0;
  let xofs = 0;
  return {
    stats: () => ({ calls, xofs }),
    get: (x, y) => {
      _seed[seedLen + 0] = x;
      _seed[seedLen + 1] = y;
      h.destroy();
      h = shake.create({}).update(_seed);
      calls++;
      return () => {
        xofs++;
        return h.xofInto(buf);
      };
    },
    clean: () => {
      h.destroy();
      cleanBytes(buf, _seed);
    }
  };
};
var XOF128 = /* @__PURE__ */ createXofShake(shake128);
var XOF256 = /* @__PURE__ */ createXofShake(shake256);

// node_modules/.pnpm/@noble+post-quantum@0.6.1/node_modules/@noble/post-quantum/ml-dsa.js
function validateInternalOpts(opts) {
  validateOpts(opts);
  if (opts.externalMu !== void 0)
    abool(opts.externalMu, "opts.externalMu");
}
var N = 256;
var Q = 8380417;
var ROOT_OF_UNITY = 1753;
var F = 8347681;
var D = 13;
var GAMMA2_1 = Math.floor((Q - 1) / 88) | 0;
var GAMMA2_2 = Math.floor((Q - 1) / 32) | 0;
var PARAMS = /* @__PURE__ */ (() => Object.freeze({
  2: Object.freeze({
    K: 4,
    L: 4,
    D,
    GAMMA1: 2 ** 17,
    GAMMA2: GAMMA2_1,
    TAU: 39,
    ETA: 2,
    OMEGA: 80
  }),
  3: Object.freeze({
    K: 6,
    L: 5,
    D,
    GAMMA1: 2 ** 19,
    GAMMA2: GAMMA2_2,
    TAU: 49,
    ETA: 4,
    OMEGA: 55
  }),
  5: Object.freeze({
    K: 8,
    L: 7,
    D,
    GAMMA1: 2 ** 19,
    GAMMA2: GAMMA2_2,
    TAU: 60,
    ETA: 2,
    OMEGA: 75
  })
}))();
var newPoly = (n) => new Int32Array(n);
var crystals = /* @__PURE__ */ genCrystals({
  N,
  Q,
  F,
  ROOT_OF_UNITY,
  newPoly,
  isKyber: false,
  brvBits: 8
});
var id = (n) => n;
var polyCoder = (d, compress = id, verify = id) => crystals.bitsCoder(d, {
  encode: (i) => compress(verify(i)),
  decode: (i) => verify(compress(i))
});
var polyAdd = (a_, b_) => {
  const a = a_;
  const b = b_;
  for (let i = 0; i < a.length; i++)
    a[i] = crystals.mod(a[i] + b[i]);
  return a;
};
var polySub = (a_, b_) => {
  const a = a_;
  const b = b_;
  for (let i = 0; i < a.length; i++)
    a[i] = crystals.mod(a[i] - b[i]);
  return a;
};
var polyShiftl = (p_) => {
  const p = p_;
  for (let i = 0; i < N; i++)
    p[i] <<= D;
  return p;
};
var polyChknorm = (p_, B) => {
  const p = p_;
  for (let i = 0; i < N; i++)
    if (Math.abs(crystals.smod(p[i])) >= B)
      return true;
  return false;
};
var MultiplyNTTs = (a_, b_) => {
  const a = a_;
  const b = b_;
  const c = newPoly(N);
  for (let i = 0; i < a.length; i++)
    c[i] = crystals.mod(a[i] * b[i]);
  return c;
};
function RejNTTPoly(xof_) {
  const xof = xof_;
  const r = newPoly(N);
  for (let j = 0; j < N; ) {
    const b = xof();
    if (b.length % 3)
      throw new Error("RejNTTPoly: unaligned block");
    for (let i = 0; j < N && i <= b.length - 3; i += 3) {
      const t = (b[i + 0] | b[i + 1] << 8 | b[i + 2] << 16) & 8388607;
      if (t < Q)
        r[j++] = t;
    }
  }
  return r;
}
function getDilithium(opts_) {
  const opts = opts_;
  const { K: K2, L: L2, GAMMA1, GAMMA2, TAU, ETA: ETA2, OMEGA } = opts;
  const { CRH_BYTES, TR_BYTES, C_TILDE_BYTES, XOF128: XOF1282, XOF256: XOF2562, securityLevel } = opts;
  if (![2, 4].includes(ETA2))
    throw new Error("Wrong ETA");
  if (![1 << 17, 1 << 19].includes(GAMMA1))
    throw new Error("Wrong GAMMA1");
  if (![GAMMA2_1, GAMMA2_2].includes(GAMMA2))
    throw new Error("Wrong GAMMA2");
  const BETA = TAU * ETA2;
  const decompose = (r) => {
    const rPlus = crystals.mod(r);
    const r0 = crystals.smod(rPlus, 2 * GAMMA2) | 0;
    if (rPlus - r0 === Q - 1)
      return { r1: 0 | 0, r0: r0 - 1 | 0 };
    const r1 = Math.floor((rPlus - r0) / (2 * GAMMA2)) | 0;
    return { r1, r0 };
  };
  const HighBits = (r) => decompose(r).r1;
  const LowBits = (r) => decompose(r).r0;
  const MakeHint = (z, r) => {
    const res0 = z <= GAMMA2 || z > Q - GAMMA2 || z === Q - GAMMA2 && r === 0 ? 0 : 1;
    return res0;
  };
  const UseHint = (h, r) => {
    const m = Math.floor((Q - 1) / (2 * GAMMA2));
    const { r1, r0 } = decompose(r);
    if (h === 1)
      return r0 > 0 ? crystals.mod(r1 + 1, m) | 0 : crystals.mod(r1 - 1, m) | 0;
    return r1 | 0;
  };
  const Power2Round = (r) => {
    const rPlus = crystals.mod(r);
    const r0 = crystals.smod(rPlus, 2 ** D) | 0;
    return { r1: Math.floor((rPlus - r0) / 2 ** D) | 0, r0 };
  };
  const hintCoder = {
    bytesLen: OMEGA + K2,
    encode: (h_) => {
      const h = h_;
      if (h === false)
        throw new Error("hint.encode: hint is false");
      const res = new Uint8Array(OMEGA + K2);
      for (let i = 0, k = 0; i < K2; i++) {
        for (let j = 0; j < N; j++)
          if (h[i][j] !== 0)
            res[k++] = j;
        res[OMEGA + i] = k;
      }
      return res;
    },
    decode: (buf) => {
      const h = [];
      let k = 0;
      for (let i = 0; i < K2; i++) {
        const hi = newPoly(N);
        if (buf[OMEGA + i] < k || buf[OMEGA + i] > OMEGA)
          return false;
        for (let j = k; j < buf[OMEGA + i]; j++) {
          if (j > k && buf[j] <= buf[j - 1])
            return false;
          hi[buf[j]] = 1;
        }
        k = buf[OMEGA + i];
        h.push(hi);
      }
      for (let j = k; j < OMEGA; j++)
        if (buf[j] !== 0)
          return false;
      return h;
    }
  };
  const ETACoder = polyCoder(ETA2 === 2 ? 3 : 4, (i) => ETA2 - i, (i) => {
    if (!(-ETA2 <= i && i <= ETA2))
      throw new Error(`malformed key s1/s3 ${i} outside of ETA range [${-ETA2}, ${ETA2}]`);
    return i;
  });
  const T0Coder = polyCoder(13, (i) => (1 << D - 1) - i);
  const T1Coder = polyCoder(10);
  const ZCoder = polyCoder(GAMMA1 === 1 << 17 ? 18 : 20, (i) => crystals.smod(GAMMA1 - i));
  const W1Coder = polyCoder(GAMMA2 === GAMMA2_1 ? 6 : 4);
  const W1Vec = vecCoder(W1Coder, K2);
  const publicCoder = splitCoder("publicKey", 32, vecCoder(T1Coder, K2));
  const secretCoder = splitCoder("secretKey", 32, 32, TR_BYTES, vecCoder(ETACoder, L2), vecCoder(ETACoder, K2), vecCoder(T0Coder, K2));
  const sigCoder = splitCoder("signature", C_TILDE_BYTES, vecCoder(ZCoder, L2), hintCoder);
  const CoefFromHalfByte = ETA2 === 2 ? (n) => n < 15 ? 2 - n % 5 : false : (n) => n < 9 ? 4 - n : false;
  function RejBoundedPoly(xof_) {
    const xof = xof_;
    const r = newPoly(N);
    for (let j = 0; j < N; ) {
      const b = xof();
      for (let i = 0; j < N && i < b.length; i += 1) {
        const d1 = CoefFromHalfByte(b[i] & 15);
        const d2 = CoefFromHalfByte(b[i] >> 4 & 15);
        if (d1 !== false)
          r[j++] = d1;
        if (j < N && d2 !== false)
          r[j++] = d2;
      }
    }
    return r;
  }
  const SampleInBall = (seed) => {
    const pre = newPoly(N);
    const s = shake256.create({}).update(seed);
    const buf = new Uint8Array(shake256.blockLen);
    s.xofInto(buf);
    const masks = buf.slice(0, 8);
    for (let i = N - TAU, pos = 8, maskPos = 0, maskBit = 0; i < N; i++) {
      let b = i + 1;
      for (; b > i; ) {
        b = buf[pos++];
        if (pos < shake256.blockLen)
          continue;
        s.xofInto(buf);
        pos = 0;
      }
      pre[i] = pre[b];
      pre[b] = 1 - ((masks[maskPos] >> maskBit++ & 1) << 1);
      if (maskBit >= 8) {
        maskPos++;
        maskBit = 0;
      }
    }
    return pre;
  };
  const polyPowerRound = (p_) => {
    const p = p_;
    const res0 = newPoly(N);
    const res1 = newPoly(N);
    for (let i = 0; i < p.length; i++) {
      const { r0, r1 } = Power2Round(p[i]);
      res0[i] = r0;
      res1[i] = r1;
    }
    return { r0: res0, r1: res1 };
  };
  const polyUseHint = (u_, h_) => {
    const u = u_;
    const h = h_;
    for (let i = 0; i < N; i++)
      u[i] = UseHint(h[i], u[i]);
    return u;
  };
  const polyMakeHint = (a_, b_) => {
    const a = a_;
    const b = b_;
    const v = newPoly(N);
    let cnt = 0;
    for (let i = 0; i < N; i++) {
      const h = MakeHint(a[i], b[i]);
      v[i] = h;
      cnt += h;
    }
    return { v, cnt };
  };
  const signRandBytes = 32;
  const seedCoder = splitCoder("seed", 32, 64, 32);
  const internal = Object.freeze({
    info: Object.freeze({ type: "internal-ml-dsa" }),
    lengths: Object.freeze({
      secretKey: secretCoder.bytesLen,
      publicKey: publicCoder.bytesLen,
      seed: 32,
      signature: sigCoder.bytesLen,
      signRand: signRandBytes
    }),
    keygen: (seed) => {
      const seedDst = new Uint8Array(32 + 2);
      const randSeed = seed === void 0;
      if (randSeed)
        seed = randomBytes3(32);
      abytesDoc(seed, 32, "seed");
      seedDst.set(seed);
      if (randSeed)
        cleanBytes(seed);
      seedDst[32] = K2;
      seedDst[33] = L2;
      const [rho, rhoPrime, K_] = seedCoder.decode(shake256(seedDst, { dkLen: seedCoder.bytesLen }));
      const xofPrime = XOF2562(rhoPrime);
      const s1 = [];
      for (let i = 0; i < L2; i++)
        s1.push(RejBoundedPoly(xofPrime.get(i & 255, i >> 8 & 255)));
      const s2 = [];
      for (let i = L2; i < L2 + K2; i++)
        s2.push(RejBoundedPoly(xofPrime.get(i & 255, i >> 8 & 255)));
      const s1Hat = s1.map((i) => crystals.NTT.encode(i.slice()));
      const t0 = [];
      const t1 = [];
      const xof = XOF1282(rho);
      const t = newPoly(N);
      for (let i = 0; i < K2; i++) {
        cleanBytes(t);
        for (let j = 0; j < L2; j++) {
          const aij = RejNTTPoly(xof.get(j, i));
          polyAdd(t, MultiplyNTTs(aij, s1Hat[j]));
        }
        crystals.NTT.decode(t);
        const { r0, r1 } = polyPowerRound(polyAdd(t, s2[i]));
        t0.push(r0);
        t1.push(r1);
      }
      const publicKey = publicCoder.encode([rho, t1]);
      const tr = shake256(publicKey, { dkLen: TR_BYTES });
      const secretKey = secretCoder.encode([rho, K_, tr, s1, s2, t0]);
      xof.clean();
      xofPrime.clean();
      cleanBytes(rho, rhoPrime, K_, s1, s2, s1Hat, t, t0, t1, tr, seedDst);
      return {
        publicKey,
        secretKey
      };
    },
    getPublicKey: (secretKey) => {
      const [rho, _K, _tr, s1, s2, _t0] = secretCoder.decode(secretKey);
      const xof = XOF1282(rho);
      const s1Hat = s1.map((p) => crystals.NTT.encode(p.slice()));
      const t1 = [];
      const tmp = newPoly(N);
      for (let i = 0; i < K2; i++) {
        tmp.fill(0);
        for (let j = 0; j < L2; j++) {
          const aij = RejNTTPoly(xof.get(j, i));
          polyAdd(tmp, MultiplyNTTs(aij, s1Hat[j]));
        }
        crystals.NTT.decode(tmp);
        polyAdd(tmp, s2[i]);
        const { r1 } = polyPowerRound(tmp);
        t1.push(r1);
      }
      xof.clean();
      cleanBytes(tmp, s1Hat, _t0, s1, s2);
      return publicCoder.encode([rho, t1]);
    },
    // NOTE: random is optional.
    sign: (msg, secretKey, opts2 = {}) => {
      validateSigOpts2(opts2);
      validateInternalOpts(opts2);
      let { extraEntropy: random, externalMu = false } = opts2;
      const [rho, _K, tr, s1, s2, t0] = secretCoder.decode(secretKey);
      const A = [];
      const xof = XOF1282(rho);
      for (let i = 0; i < K2; i++) {
        const pv = [];
        for (let j = 0; j < L2; j++)
          pv.push(RejNTTPoly(xof.get(j, i)));
        A.push(pv);
      }
      xof.clean();
      for (let i = 0; i < L2; i++)
        crystals.NTT.encode(s1[i]);
      for (let i = 0; i < K2; i++) {
        crystals.NTT.encode(s2[i]);
        crystals.NTT.encode(t0[i]);
      }
      const mu = externalMu ? msg : (
        // 6: µ ← H(tr||M, 512)
        //    ▷ Compute message representative µ
        shake256.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest()
      );
      const rnd = random === false ? new Uint8Array(32) : random === void 0 ? randomBytes3(signRandBytes) : random;
      abytesDoc(rnd, 32, "extraEntropy");
      const rhoprime = shake256.create({ dkLen: CRH_BYTES }).update(_K).update(rnd).update(mu).digest();
      abytesDoc(rhoprime, CRH_BYTES);
      const x256 = XOF2562(rhoprime, ZCoder.bytesLen);
      main_loop: for (let kappa = 0; ; ) {
        const y = [];
        for (let i = 0; i < L2; i++, kappa++)
          y.push(ZCoder.decode(x256.get(kappa & 255, kappa >> 8)()));
        const z = y.map((i) => crystals.NTT.encode(i.slice()));
        const w = [];
        for (let i = 0; i < K2; i++) {
          const wi = newPoly(N);
          for (let j = 0; j < L2; j++)
            polyAdd(wi, MultiplyNTTs(A[i][j], z[j]));
          crystals.NTT.decode(wi);
          w.push(wi);
        }
        const w1 = w.map((j) => j.map(HighBits));
        const cTilde = shake256.create({ dkLen: C_TILDE_BYTES }).update(mu).update(W1Vec.encode(w1)).digest();
        const cHat = crystals.NTT.encode(SampleInBall(cTilde));
        const cs1 = s1.map((i) => MultiplyNTTs(i, cHat));
        for (let i = 0; i < L2; i++) {
          polyAdd(crystals.NTT.decode(cs1[i]), y[i]);
          if (polyChknorm(cs1[i], GAMMA1 - BETA))
            continue main_loop;
        }
        let cnt = 0;
        const h = [];
        for (let i = 0; i < K2; i++) {
          const cs2 = crystals.NTT.decode(MultiplyNTTs(s2[i], cHat));
          const r0 = polySub(w[i], cs2).map(LowBits);
          if (polyChknorm(r0, GAMMA2 - BETA))
            continue main_loop;
          const ct0 = crystals.NTT.decode(MultiplyNTTs(t0[i], cHat));
          if (polyChknorm(ct0, GAMMA2))
            continue main_loop;
          polyAdd(r0, ct0);
          const hint = polyMakeHint(r0, w1[i]);
          h.push(hint.v);
          cnt += hint.cnt;
        }
        if (cnt > OMEGA)
          continue;
        x256.clean();
        const res = sigCoder.encode([cTilde, cs1, h]);
        cleanBytes(cTilde, cs1, h, cHat, w1, w, z, y, rhoprime, s1, s2, t0, ...A);
        if (!externalMu)
          cleanBytes(mu);
        return res;
      }
      throw new Error("Unreachable code path reached, report this error");
    },
    verify: (sig, msg, publicKey, opts2 = {}) => {
      validateInternalOpts(opts2);
      const { externalMu = false } = opts2;
      const [rho, t1] = publicCoder.decode(publicKey);
      const tr = shake256(publicKey, { dkLen: TR_BYTES });
      if (sig.length !== sigCoder.bytesLen)
        return false;
      const [cTilde, z, h] = sigCoder.decode(sig);
      if (h === false)
        return false;
      for (let i = 0; i < L2; i++)
        if (polyChknorm(z[i], GAMMA1 - BETA))
          return false;
      const mu = externalMu ? msg : (
        // 7: µ ← H(tr||M, 512)
        shake256.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest()
      );
      const c = crystals.NTT.encode(SampleInBall(cTilde));
      const zNtt = z.map((i) => i.slice());
      for (let i = 0; i < L2; i++)
        crystals.NTT.encode(zNtt[i]);
      const wTick1 = [];
      const xof = XOF1282(rho);
      for (let i = 0; i < K2; i++) {
        const ct12d = MultiplyNTTs(crystals.NTT.encode(polyShiftl(t1[i])), c);
        const Az = newPoly(N);
        for (let j = 0; j < L2; j++) {
          const aij = RejNTTPoly(xof.get(j, i));
          polyAdd(Az, MultiplyNTTs(aij, zNtt[j]));
        }
        const wApprox = crystals.NTT.decode(polySub(Az, ct12d));
        wTick1.push(polyUseHint(wApprox, h[i]));
      }
      xof.clean();
      const c2 = shake256.create({ dkLen: C_TILDE_BYTES }).update(mu).update(W1Vec.encode(wTick1)).digest();
      for (const t of h) {
        const sum = t.reduce((acc, i) => acc + i, 0);
        if (!(sum <= OMEGA))
          return false;
      }
      for (const t of z)
        if (polyChknorm(t, GAMMA1 - BETA))
          return false;
      return equalBytes2(cTilde, c2);
    }
  });
  return Object.freeze({
    info: Object.freeze({ type: "ml-dsa" }),
    internal,
    securityLevel,
    keygen: internal.keygen,
    lengths: internal.lengths,
    getPublicKey: internal.getPublicKey,
    sign: (msg, secretKey, opts2 = {}) => {
      validateSigOpts2(opts2);
      const M = getMessage(msg, opts2.context);
      const res = internal.sign(M, secretKey, opts2);
      cleanBytes(M);
      return res;
    },
    verify: (sig, msg, publicKey, opts2 = {}) => {
      validateVerOpts(opts2);
      return internal.verify(sig, getMessage(msg, opts2.context), publicKey);
    },
    prehash: (hash) => {
      checkHash(hash, securityLevel);
      return Object.freeze({
        info: Object.freeze({ type: "hashml-dsa" }),
        securityLevel,
        lengths: internal.lengths,
        keygen: internal.keygen,
        getPublicKey: internal.getPublicKey,
        sign: (msg, secretKey, opts2 = {}) => {
          validateSigOpts2(opts2);
          const M = getMessagePrehash(hash, msg, opts2.context);
          const res = internal.sign(M, secretKey, opts2);
          cleanBytes(M);
          return res;
        },
        verify: (sig, msg, publicKey, opts2 = {}) => {
          validateVerOpts(opts2);
          return internal.verify(sig, getMessagePrehash(hash, msg, opts2.context), publicKey);
        }
      });
    }
  });
}
var ml_dsa65 = /* @__PURE__ */ (() => getDilithium({
  ...PARAMS[3],
  CRH_BYTES: 64,
  TR_BYTES: 64,
  C_TILDE_BYTES: 48,
  XOF128,
  XOF256,
  securityLevel: 192
}))();

// node_modules/.pnpm/near-api-js@7.4.0/node_modules/near-api-js/lib/rpc-errors/index.js
var RpcError = class extends Error {
  constructor() {
    super(...arguments);
    this.name = this.constructor.name;
  }
};
var InternalRpcError = class extends RpcError {
};
var HandlerError = class extends RpcError {
};
var ShardNotAppliedError = class extends HandlerError {
  constructor(shardId) {
    super(`Shard ${shardId} is not applied yet`);
    this.shardId = shardId;
  }
};
var AccountDoesNotExistError = class extends HandlerError {
  constructor(accountId, blockHash, blockHeight) {
    super(`Account ${accountId} does not exist at block height ${blockHeight}`);
    this.accountId = accountId;
    this.blockHash = blockHash;
    this.blockHeight = blockHeight;
  }
};
var AccessKeyDoesNotExistError = class extends HandlerError {
  constructor(publicKey, blockHash, blockHeight) {
    super(`Access key ${publicKey.toString()} does not exist at block height ${blockHeight}`);
    this.publicKey = publicKey;
    this.blockHash = blockHash;
    this.blockHeight = blockHeight;
  }
};
var UnknownBlockError = class extends HandlerError {
  constructor(blockReference) {
    let metadata = "";
    if (typeof blockReference === "object" && "block_id" in blockReference) {
      metadata = `block = ${blockReference.block_id}`;
    } else if (typeof blockReference === "object" && "finality" in blockReference) {
      metadata = `finality = ${blockReference.finality}`;
    } else if (typeof blockReference === "object" && "sync_checkpoint" in blockReference) {
      metadata = `sync checkpoint = ${blockReference.sync_checkpoint}`;
    }
    super(
      `Block either has never been observed on the node or has been garbage collected ${metadata ? `(${metadata})` : ""}`.trimEnd()
    );
    this.blockReference = blockReference;
  }
};
var GasKeyDoesNotExistError = class extends HandlerError {
  constructor(publicKey, blockHash, blockHeight) {
    super(`Gas key for public key ${publicKey.toString()} does not exist at block height ${blockHeight}`);
    this.publicKey = publicKey;
    this.blockHash = blockHash;
    this.blockHeight = blockHeight;
  }
};
var GlobalContractCodeDoesNotExistError = class extends HandlerError {
  constructor(identifier, blockHash, blockHeight) {
    super(`Global contract code does not exist at block height ${blockHeight}`);
    this.identifier = identifier;
    this.blockHash = blockHash;
    this.blockHeight = blockHeight;
  }
};
var GarbageCollectedBlockError = class extends HandlerError {
  constructor(blockHash, blockHeight) {
    super(`Block ${blockHash} has been garbage collected`);
    this.blockHash = blockHash;
    this.blockHeight = blockHeight;
  }
};
var InvalidShardIdError = class extends HandlerError {
  constructor(shardId) {
    super(`Invalid shard id ${shardId}`);
    this.shardId = shardId;
  }
};
var UnavailableShardError = class extends HandlerError {
  constructor(shardId) {
    super(`Shard ${shardId} is unavailable`);
    this.shardId = shardId;
  }
};
var InvalidTransactionError = class extends HandlerError {
  constructor() {
    super(`Invalid transaction`);
  }
};
var UnknownTransactionError = class extends HandlerError {
  constructor(txHash) {
    super(`Unknown transaction ${txHash}`);
    this.txHash = txHash;
  }
};
var TransactionTimeoutError = class extends HandlerError {
  constructor() {
    super(`Transaction timed out`);
  }
};
var UnknownEpochError = class extends HandlerError {
  constructor() {
    super(`Unknown epoch`);
  }
};
var EpochOutOfBoundsError = class extends HandlerError {
  constructor(epochId) {
    super(`Epoch ${epochId} is out of bounds`);
    this.epochId = epochId;
  }
};
var NodeIsSyncingError = class extends HandlerError {
  constructor() {
    super(`Node is syncing`);
  }
};
var NoNewBlocksError = class extends HandlerError {
  constructor() {
    super(`No new blocks produced`);
  }
};
var UnknownReceiptError = class extends HandlerError {
  constructor(receiptId) {
    super(`Unknown receipt ${receiptId}`);
    this.receiptId = receiptId;
  }
};
var InternalHandlerError = class extends HandlerError {
};
var NotSyncedYetError = class extends HandlerError {
  constructor() {
    super(`Node is not synced yet`);
  }
};
var UnknownChunkError = class extends HandlerError {
  constructor(chunkHash) {
    super(`Unknown chunk ${chunkHash}`);
    this.chunkHash = chunkHash;
  }
};
var DoesNotTrackShardError = class extends HandlerError {
  constructor() {
    super(`Node does not track this shard`);
  }
};
var RequestRoutedError = class extends HandlerError {
  constructor(transactionHash) {
    super(`Request was routed for transaction ${transactionHash}`);
    this.transactionHash = transactionHash;
  }
};
var ValidatorInfoUnavailableError = class extends HandlerError {
  constructor() {
    super(`Validator info is unavailable`);
  }
};
var NoSyncedBlocksError = class extends HandlerError {
  constructor() {
    super(`No synced blocks available`);
  }
};
var InvalidAccountError = class extends HandlerError {
  constructor(requestedAccountId, blockHash, blockHeight) {
    super(`Invalid account ${requestedAccountId} at block height ${blockHeight}`);
    this.requestedAccountId = requestedAccountId;
    this.blockHash = blockHash;
    this.blockHeight = blockHeight;
  }
};
var TooLargeContractStateError = class extends HandlerError {
  constructor(contractAccountId, blockHash, blockHeight) {
    super(`Contract state for ${contractAccountId} is too large at block height ${blockHeight}`);
    this.contractAccountId = contractAccountId;
    this.blockHash = blockHash;
    this.blockHeight = blockHeight;
  }
};
var InconsistentStateError = class extends HandlerError {
  constructor(executionOutcomeShardId, numberOfShards) {
    super(`Inconsistent state: outcome shard ${executionOutcomeShardId}, number of shards ${numberOfShards}`);
    this.executionOutcomeShardId = executionOutcomeShardId;
    this.numberOfShards = numberOfShards;
  }
};
var NotConfirmedError = class extends HandlerError {
  constructor(transactionOrReceiptId) {
    super(`Transaction or receipt ${transactionOrReceiptId} is not confirmed`);
    this.transactionOrReceiptId = transactionOrReceiptId;
  }
};
var UnknownTransactionOrReceiptError = class extends HandlerError {
  constructor(transactionOrReceiptId) {
    super(`Unknown transaction or receipt ${transactionOrReceiptId}`);
    this.transactionOrReceiptId = transactionOrReceiptId;
  }
};
var ContractExecutionError = class extends HandlerError {
  constructor(message, blockHash, blockHeight) {
    super(message);
    this.blockHash = blockHash;
    this.blockHeight = blockHeight;
  }
};
var WasmTrapError = class extends ContractExecutionError {
  constructor(reason, blockHash, blockHeight) {
    super(`WASM trap during contract execution at block height ${blockHeight}`, blockHash, blockHeight);
    this.reason = reason;
  }
};
var ContractCodeDoesNotExistError = class extends ContractExecutionError {
  constructor(contractId, blockHash, blockHeight) {
    super(
      `Contract code for contract ID ${contractId} does not exist at block height ${blockHeight}`,
      blockHash,
      blockHeight
    );
    this.contractId = contractId;
  }
};
var ContractMethodNotFoundError = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super(`Contract method is not found at block height ${blockHeight}`, blockHash, blockHeight);
  }
};
var ContractMethodNameEmptyError = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super(`Contract method name is empty`, blockHash, blockHeight);
  }
};
var ContractMethodInvalidSignatureError = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super(`Contract method invalid signature`, blockHash, blockHeight);
  }
};
var PrepareWasmError = class extends ContractExecutionError {
  constructor(reason, blockHash, blockHeight) {
    super(`Failed to prepare WASM because of '${reason}'`, blockHash, blockHeight);
    this.reason = reason;
  }
};
var HostBadUtf16Error = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super("Bad UTF-16", blockHash, blockHeight);
  }
};
var HostBadUtf8Error = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super("Bad UTF-8", blockHash, blockHeight);
  }
};
var HostGasExceededError = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super("Gas exceeded", blockHash, blockHeight);
  }
};
var HostGasLimitExceededError = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super("Gas limit exceeded", blockHash, blockHeight);
  }
};
var HostBalanceExceededError = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super("Balance exceeded", blockHash, blockHeight);
  }
};
var HostEmptyMethodNameError = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super("Empty method name", blockHash, blockHeight);
  }
};
var HostGuestPanicError = class extends ContractExecutionError {
  constructor(panicMessage, blockHash, blockHeight) {
    super(`Contract panicked: ${panicMessage}`, blockHash, blockHeight);
    this.panicMessage = panicMessage;
  }
};
var HostIntegerOverflowError = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super("Integer overflow", blockHash, blockHeight);
  }
};
var HostInvalidPromiseIndexError = class extends ContractExecutionError {
  constructor(promiseIndex, blockHash, blockHeight) {
    super(`Invalid promise index ${promiseIndex}`, blockHash, blockHeight);
    this.promiseIndex = promiseIndex;
  }
};
var HostCannotAppendActionToJointPromiseError = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super("Cannot append action to joint promise", blockHash, blockHeight);
  }
};
var HostCannotReturnJointPromiseError = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super(`Cannot return joint promise`, blockHash, blockHeight);
  }
};
var HostInvalidPromiseResultIndexError = class extends ContractExecutionError {
  constructor(resultIndex, blockHash, blockHeight) {
    super(`Invalid promise result index ${resultIndex}`, blockHash, blockHeight);
    this.resultIndex = resultIndex;
  }
};
var HostInvalidRegisterIdError = class extends ContractExecutionError {
  constructor(registerId, blockHash, blockHeight) {
    super(`Invalid register id ${registerId}`, blockHash, blockHeight);
    this.registerId = registerId;
  }
};
var HostIteratorWasInvalidatedError = class extends ContractExecutionError {
  constructor(iteratorIndex, blockHash, blockHeight) {
    super(`Iterator ${iteratorIndex} was invalidated`, blockHash, blockHeight);
    this.iteratorIndex = iteratorIndex;
  }
};
var HostMemoryAccessViolationError = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super(`Memory access violation`, blockHash, blockHeight);
  }
};
var HostInvalidReceiptIndexError = class extends ContractExecutionError {
  constructor(receiptIndex, blockHash, blockHeight) {
    super(`Invalid receipt index ${receiptIndex}`, blockHash, blockHeight);
    this.receiptIndex = receiptIndex;
  }
};
var HostInvalidIteratorIndexError = class extends ContractExecutionError {
  constructor(iteratorIndex, blockHash, blockHeight) {
    super(`Invalid iterator index ${iteratorIndex}`, blockHash, blockHeight);
    this.iteratorIndex = iteratorIndex;
  }
};
var HostInvalidAccountIdError = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super(`Invalid account ID`, blockHash, blockHeight);
  }
};
var HostInvalidMethodNameError = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super(`Invalid method name`, blockHash, blockHeight);
  }
};
var HostInvalidPublicKeyError = class extends ContractExecutionError {
  constructor(blockHash, blockHeight) {
    super(`Invalid public key`, blockHash, blockHeight);
  }
};
var HostProhibitedInViewError = class extends ContractExecutionError {
  constructor(methodName, blockHash, blockHeight) {
    super(`Method ${methodName} is prohibited in view calls`, blockHash, blockHeight);
    this.methodName = methodName;
  }
};
var HostNumberOfLogsExceededError = class extends ContractExecutionError {
  constructor(limit, blockHash, blockHeight) {
    super(`Number of logs exceeded limit ${limit}`, blockHash, blockHeight);
    this.limit = limit;
  }
};
var HostKeyLengthExceededError = class extends ContractExecutionError {
  constructor(length, limit, blockHash, blockHeight) {
    super(`Key length ${length} exceeds limit ${limit}`, blockHash, blockHeight);
    this.length = length;
    this.limit = limit;
  }
};
var HostValueLengthExceededError = class extends ContractExecutionError {
  constructor(length, limit, blockHash, blockHeight) {
    super(`Value length ${length} exceeds limit ${limit}`, blockHash, blockHeight);
    this.length = length;
    this.limit = limit;
  }
};
var HostTotalLogLengthExceededError = class extends ContractExecutionError {
  constructor(length, limit, blockHash, blockHeight) {
    super(`Total log length ${length} exceeds limit ${limit}`, blockHash, blockHeight);
    this.length = length;
    this.limit = limit;
  }
};
var HostNumberPromisesExceededError = class extends ContractExecutionError {
  constructor(limit, numberOfPromises, blockHash, blockHeight) {
    super(`Number of promises ${numberOfPromises} exceeds limit ${limit}`, blockHash, blockHeight);
    this.limit = limit;
    this.numberOfPromises = numberOfPromises;
  }
};
var HostNumberInputDataDependenciesExceededError = class extends ContractExecutionError {
  constructor(limit, numberOfInputDataDependencies, blockHash, blockHeight) {
    super(
      `Number of input data dependencies ${numberOfInputDataDependencies} exceeds limit ${limit}`,
      blockHash,
      blockHeight
    );
    this.limit = limit;
    this.numberOfInputDataDependencies = numberOfInputDataDependencies;
  }
};
var HostReturnedValueLengthExceededError = class extends ContractExecutionError {
  constructor(length, limit, blockHash, blockHeight) {
    super(`Returned value length ${length} exceeds limit ${limit}`, blockHash, blockHeight);
    this.length = length;
    this.limit = limit;
  }
};
var HostSizeExceededError = class extends ContractExecutionError {
  constructor(size, limit, blockHash, blockHeight) {
    super(`Contract size ${size} exceeds limit ${limit}`, blockHash, blockHeight);
    this.size = size;
    this.limit = limit;
  }
};
var HostDeprecatedError = class extends ContractExecutionError {
  constructor(methodName, blockHash, blockHeight) {
    super(`Method ${methodName} is deprecated`, blockHash, blockHeight);
    this.methodName = methodName;
  }
};
var HostECRecoverError = class extends ContractExecutionError {
  constructor(message, blockHash, blockHeight) {
    super(`ECRecover error: ${message}`, blockHash, blockHeight);
  }
};
var HostAltBn128InvalidInputError = class extends ContractExecutionError {
  constructor(message, blockHash, blockHeight) {
    super(`AltBn128 invalid input: ${message}`, blockHash, blockHeight);
  }
};
var HostEd25519VerifyInvalidInputError = class extends ContractExecutionError {
  constructor(message, blockHash, blockHeight) {
    super(`Ed25519 verify invalid input: ${message}`, blockHash, blockHeight);
  }
};
var HostP256VerifyInvalidInputError = class extends ContractExecutionError {
  constructor(message, blockHash, blockHeight) {
    super(`P256 verify invalid input: ${message}`, blockHash, blockHeight);
  }
};
var RequestValidationError = class extends RpcError {
};
var RpcMethodNotFoundError = class extends RequestValidationError {
  constructor(methodName) {
    super(`RPC method ${methodName} not found`);
    this.methodName = methodName;
  }
};
var RpcRequestParseError = class extends RequestValidationError {
};
var TransactionExecutionError = class extends RpcError {
  constructor(message, txHash, blockHash) {
    super(message);
    this.txHash = txHash;
    this.blockHash = blockHash;
  }
};
var ActionExecutionError = class extends TransactionExecutionError {
  constructor(message, actionIndex, txHash, blockHash) {
    super(message, txHash, blockHash);
    this.actionIndex = actionIndex;
  }
};
var AccountAlreadyExistsActionError = class extends ActionExecutionError {
  constructor(accountId, actionIndex, txHash, blockHash) {
    super(`Account ${accountId} already exists`, actionIndex, txHash, blockHash);
    this.accountId = accountId;
  }
};
var AccountDoesNotExistActionError = class extends ActionExecutionError {
  constructor(accountId, actionIndex, txHash, blockHash) {
    super(`Account ${accountId} does not exist`, actionIndex, txHash, blockHash);
    this.accountId = accountId;
  }
};
var ActorNoPermissionActionError = class extends ActionExecutionError {
  constructor(accountId, actorId, actionIndex, txHash, blockHash) {
    super(`Actor ${actorId} has no permission on account ${accountId}`, actionIndex, txHash, blockHash);
    this.accountId = accountId;
    this.actorId = actorId;
  }
};
var AddKeyAlreadyExistsActionError = class extends ActionExecutionError {
  constructor(accountId, publicKey, actionIndex, txHash, blockHash) {
    super(`Public key ${publicKey} already exists on account ${accountId}`, actionIndex, txHash, blockHash);
    this.accountId = accountId;
    this.publicKey = publicKey;
  }
};
var DeleteKeyDoesNotExistActionError = class extends ActionExecutionError {
  constructor(accountId, publicKey, actionIndex, txHash, blockHash) {
    super(`Public key ${publicKey} does not exist on account ${accountId}`, actionIndex, txHash, blockHash);
    this.accountId = accountId;
    this.publicKey = publicKey;
  }
};
var DeleteAccountStakingActionError = class extends ActionExecutionError {
  constructor(accountId, actionIndex, txHash, blockHash) {
    super(`Account ${accountId} cannot be deleted because it is staking`, actionIndex, txHash, blockHash);
    this.accountId = accountId;
  }
};
var LackBalanceForStateActionError = class extends ActionExecutionError {
  constructor(accountId, amount, actionIndex, txHash, blockHash) {
    super(
      `Account ${accountId} lacks balance ${amount.toString()} yoctoNear for state`,
      actionIndex,
      txHash,
      blockHash
    );
    this.accountId = accountId;
    this.amount = amount;
  }
};
var TriesToUnstakeActionError = class extends ActionExecutionError {
  constructor(accountId, actionIndex, txHash, blockHash) {
    super(`Account ${accountId} tries to unstake`, actionIndex, txHash, blockHash);
    this.accountId = accountId;
  }
};
var TriesToStakeActionError = class extends ActionExecutionError {
  constructor(accountId, balance, locked, stake5, actionIndex, txHash, blockHash) {
    super(
      `Invalid stake attempt for ${accountId} (balance: ${balance}, locked: ${locked}, stake: ${stake5})`,
      actionIndex,
      txHash,
      blockHash
    );
    this.accountId = accountId;
    this.balance = balance;
    this.locked = locked;
    this.stake = stake5;
  }
};
var InsufficientStakeActionError = class extends ActionExecutionError {
  constructor(accountId, minimumStake, stake5, actionIndex, txHash, blockHash) {
    super(
      `Insufficient stake for ${accountId} (minimum: ${minimumStake}, stake: ${stake5})`,
      actionIndex,
      txHash,
      blockHash
    );
    this.accountId = accountId;
    this.minimumStake = minimumStake;
    this.stake = stake5;
  }
};
var OnlyImplicitAccountCreationAllowedActionError = class extends ActionExecutionError {
  constructor(accountId, actionIndex, txHash, blockHash) {
    super(`Only implicit account creation allowed for ${accountId}`, actionIndex, txHash, blockHash);
    this.accountId = accountId;
  }
};
var DeleteAccountWithLargeStateActionError = class extends ActionExecutionError {
  constructor(accountId, actionIndex, txHash, blockHash) {
    super(`Account ${accountId} cannot be deleted because it has a large state`, actionIndex, txHash, blockHash);
    this.accountId = accountId;
  }
};
var DelegateActionInvalidSignatureActionError = class extends ActionExecutionError {
  constructor(actionIndex, txHash, blockHash) {
    super(`Delegate action has an invalid signature`, actionIndex, txHash, blockHash);
  }
};
var DelegateActionExpiredActionError = class extends ActionExecutionError {
  constructor(actionIndex, txHash, blockHash) {
    super(`Delegate action has expired`, actionIndex, txHash, blockHash);
  }
};
var DelegateActionInvalidNonceActionError = class extends ActionExecutionError {
  constructor(akNonce, delegateNonce, actionIndex, txHash, blockHash) {
    super(`Invalid delegate nonce (ak: ${akNonce}, delegate: ${delegateNonce})`, actionIndex, txHash, blockHash);
    this.akNonce = akNonce;
    this.delegateNonce = delegateNonce;
  }
};
var DelegateActionNonceTooLargeActionError = class extends ActionExecutionError {
  constructor(delegateNonce, upperBound, actionIndex, txHash, blockHash) {
    super(`Delegate nonce ${delegateNonce} exceeds upper bound ${upperBound}`, actionIndex, txHash, blockHash);
    this.delegateNonce = delegateNonce;
    this.upperBound = upperBound;
  }
};
var GasKeyDoesNotExistActionError = class extends ActionExecutionError {
  constructor(accountId, publicKey, actionIndex, txHash, blockHash) {
    super(`Gas key ${publicKey} does not exist on account ${accountId}`, actionIndex, txHash, blockHash);
    this.accountId = accountId;
    this.publicKey = publicKey;
  }
};
var InsufficientGasKeyBalanceActionError = class extends ActionExecutionError {
  constructor(accountId, publicKey, balance, required, actionIndex, txHash, blockHash) {
    super(
      `Gas key ${publicKey} on account ${accountId} has insufficient balance (balance: ${balance}, required: ${required})`,
      actionIndex,
      txHash,
      blockHash
    );
    this.accountId = accountId;
    this.publicKey = publicKey;
    this.balance = balance;
    this.required = required;
  }
};
var GasKeyBalanceTooHighActionError = class extends ActionExecutionError {
  constructor(accountId, balance, publicKey, actionIndex, txHash, blockHash) {
    super(
      `Gas key balance ${balance} on account ${accountId} is too high to be deleted, withdraw it first`,
      actionIndex,
      txHash,
      blockHash
    );
    this.accountId = accountId;
    this.balance = balance;
    this.publicKey = publicKey;
  }
};
var DelegateActionInvalidNonceIndexActionError = class extends ActionExecutionError {
  constructor(nonceIndex, numNonces, actionIndex, txHash, blockHash) {
    super(
      `Delegate nonce index ${nonceIndex} exceeds number of nonces ${numNonces}`,
      actionIndex,
      txHash,
      blockHash
    );
    this.nonceIndex = nonceIndex;
    this.numNonces = numNonces;
  }
};
var GlobalContractDoesNotExistActionError = class extends ActionExecutionError {
  constructor(identifier, actionIndex, txHash, blockHash) {
    super(`Global contract ${identifier} does not exist`, actionIndex, txHash, blockHash);
    this.identifier = identifier;
  }
};
var CreateAccountOnlyByRegistrarActionError = class extends ActionExecutionError {
  constructor(accountId, predecessorId, registrarAccountId, actionIndex, txHash, blockHash) {
    super(
      `Account ${accountId} can only be created by registrar ${registrarAccountId}, but was attempted by ${predecessorId}`,
      actionIndex,
      txHash,
      blockHash
    );
    this.accountId = accountId;
    this.predecessorId = predecessorId;
    this.registrarAccountId = registrarAccountId;
  }
};
var CreateAccountNotAllowedActionError = class extends ActionExecutionError {
  constructor(accountId, predecessorId, actionIndex, txHash, blockHash) {
    super(`Account ${accountId} cannot be created by ${predecessorId}`, actionIndex, txHash, blockHash);
    this.accountId = accountId;
    this.predecessorId = predecessorId;
  }
};
var DelegateActionSenderDoesNotMatchTxReceiverActionError = class extends ActionExecutionError {
  constructor(receiverId, senderId, actionIndex, txHash, blockHash) {
    super(
      `Delegate action sender ${senderId} does not match transaction receiver ${receiverId}`,
      actionIndex,
      txHash,
      blockHash
    );
    this.receiverId = receiverId;
    this.senderId = senderId;
  }
};
var AccessKeyNotFoundActionError = class extends ActionExecutionError {
  constructor(accountId, publicKey, actionIndex, txHash, blockHash) {
    super(`Access key ${publicKey} does not exist on account ${accountId}`, actionIndex, txHash, blockHash);
    this.accountId = accountId;
    this.publicKey = publicKey;
  }
};
var AccessKeyReceiverMismatchActionError = class extends ActionExecutionError {
  constructor(akReceiver, txReceiver, actionIndex, txHash, blockHash) {
    super(
      `Access key receiver ${akReceiver} does not match transaction receiver ${txReceiver}`,
      actionIndex,
      txHash,
      blockHash
    );
    this.akReceiver = akReceiver;
    this.txReceiver = txReceiver;
  }
};
var AccessKeyMethodNameMismatchActionError = class extends ActionExecutionError {
  constructor(methodName, actionIndex, txHash, blockHash) {
    super(`Access key does not allow method ${methodName}`, actionIndex, txHash, blockHash);
    this.methodName = methodName;
  }
};
var AccessKeyRequiresFullAccessActionError = class extends ActionExecutionError {
  constructor(actionIndex, txHash, blockHash) {
    super(`Access key requires full access`, actionIndex, txHash, blockHash);
  }
};
var AccessKeyNotEnoughAllowanceActionError = class extends ActionExecutionError {
  constructor(accountId, allowance, cost, publicKey, actionIndex, txHash, blockHash) {
    super(
      `Not enough allowance for access key ${publicKey} on account ${accountId} (allowance: ${allowance}, cost: ${cost})`,
      actionIndex,
      txHash,
      blockHash
    );
    this.accountId = accountId;
    this.allowance = allowance;
    this.cost = cost;
    this.publicKey = publicKey;
  }
};
var AccessKeyDepositWithFunctionCallActionError = class extends ActionExecutionError {
  constructor(actionIndex, txHash, blockHash) {
    super(`Deposit is not allowed with function call`, actionIndex, txHash, blockHash);
  }
};
var InvalidPredecessorIdReceiptActionError = class extends ActionExecutionError {
  constructor(accountId, actionIndex, txHash, blockHash) {
    super(`Invalid predecessor ID: ${accountId}`, actionIndex, txHash, blockHash);
  }
};
var InvalidReceiverIdReceiptActionError = class extends ActionExecutionError {
  constructor(accountId, actionIndex, txHash, blockHash) {
    super(`Invalid receiver ID: ${accountId}`, actionIndex, txHash, blockHash);
  }
};
var InvalidSignerIdReceiptActionError = class extends ActionExecutionError {
  constructor(accountId, actionIndex, txHash, blockHash) {
    super(`Invalid signer ID: ${accountId}`, actionIndex, txHash, blockHash);
  }
};
var InvalidDataReceiverIdReceiptActionError = class extends ActionExecutionError {
  constructor(accountId, actionIndex, txHash, blockHash) {
    super(`Invalid data receiver ID: ${accountId}`, actionIndex, txHash, blockHash);
  }
};
var ReturnedValueLengthExceededReceiptActionError = class extends ActionExecutionError {
  constructor(length, limit, actionIndex, txHash, blockHash) {
    super(`Returned value length ${length} exceeds limit ${limit}`, actionIndex, txHash, blockHash);
  }
};
var NumberInputDataDependenciesExceededReceiptActionError = class extends ActionExecutionError {
  constructor(limit, count, actionIndex, txHash, blockHash) {
    super(`Number of input data dependencies ${count} exceeds limit ${limit}`, actionIndex, txHash, blockHash);
  }
};
var ReceiptSizeExceededActionError = class extends ActionExecutionError {
  constructor(limit, size, actionIndex, txHash, blockHash) {
    super(`Receipt size ${size} exceeds limit ${limit}`, actionIndex, txHash, blockHash);
  }
};
var InvalidRefundToReceiptActionError = class extends ActionExecutionError {
  constructor(accountId, actionIndex, txHash, blockHash) {
    super(`Invalid refund-to account ID: ${accountId}`, actionIndex, txHash, blockHash);
  }
};
var DeleteActionMustBeFinalActionError = class extends ActionExecutionError {
  constructor(actionIndex, txHash, blockHash) {
    super(`Delete action must be final`, actionIndex, txHash, blockHash);
  }
};
var TotalPrepaidGasExceededActionError = class extends ActionExecutionError {
  constructor(limit, total, actionIndex, txHash, blockHash) {
    super(`Total prepaid gas ${total} exceeds limit ${limit}`, actionIndex, txHash, blockHash);
  }
};
var TotalNumberOfActionsExceededActionError = class extends ActionExecutionError {
  constructor(limit, total, actionIndex, txHash, blockHash) {
    super(`Total number of actions ${total} exceeds limit ${limit}`, actionIndex, txHash, blockHash);
  }
};
var AddKeyMethodNamesNumberOfBytesExceededActionError = class extends ActionExecutionError {
  constructor(limit, totalBytes, actionIndex, txHash, blockHash) {
    super(`Total method name bytes ${totalBytes} exceed limit ${limit}`, actionIndex, txHash, blockHash);
  }
};
var AddKeyMethodNameLengthExceededActionError = class extends ActionExecutionError {
  constructor(length, limit, actionIndex, txHash, blockHash) {
    super(`Method name length ${length} exceeds limit ${limit}`, actionIndex, txHash, blockHash);
  }
};
var IntegerOverflowValidationActionError = class extends ActionExecutionError {
  constructor(actionIndex, txHash, blockHash) {
    super(`Integer overflow during action validation`, actionIndex, txHash, blockHash);
  }
};
var InvalidAccountIdValidationActionError = class extends ActionExecutionError {
  constructor(accountId, actionIndex, txHash, blockHash) {
    super(`Invalid account ID: ${accountId}`, actionIndex, txHash, blockHash);
  }
};
var ContractSizeExceededValidationActionError = class extends ActionExecutionError {
  constructor(limit, size, actionIndex, txHash, blockHash) {
    super(`Contract size ${size} exceeds limit ${limit}`, actionIndex, txHash, blockHash);
  }
};
var FunctionCallMethodNameLengthExceededActionError = class extends ActionExecutionError {
  constructor(length, limit, actionIndex, txHash, blockHash) {
    super(`Function method name length ${length} exceeds limit ${limit}`, actionIndex, txHash, blockHash);
  }
};
var FunctionCallArgumentsLengthExceededActionError = class extends ActionExecutionError {
  constructor(length, limit, actionIndex, txHash, blockHash) {
    super(`Function call arguments length ${length} exceeds limit ${limit}`, actionIndex, txHash, blockHash);
  }
};
var UnsuitableStakingKeyActionError = class extends ActionExecutionError {
  constructor(publicKey, actionIndex, txHash, blockHash) {
    super(`Unsuitable staking key ${publicKey}`, actionIndex, txHash, blockHash);
  }
};
var FunctionCallZeroAttachedGasActionError = class extends ActionExecutionError {
  constructor(actionIndex, txHash, blockHash) {
    super(`Function call has zero attached gas`, actionIndex, txHash, blockHash);
  }
};
var GasKeyFunctionCallAllowanceNotAllowedActionError = class extends ActionExecutionError {
  constructor(actionIndex, txHash, blockHash) {
    super(`Function call gas keys can not have an allowance`, actionIndex, txHash, blockHash);
  }
};
var DelegateActionRequiresGasKeyActionError = class extends ActionExecutionError {
  constructor(actionIndex, txHash, blockHash) {
    super(`Delegate action requires a gas key`, actionIndex, txHash, blockHash);
  }
};
var DelegateActionRequiresNonGasKeyActionError = class extends ActionExecutionError {
  constructor(actionIndex, txHash, blockHash) {
    super(`Delegate action can not be signed with a gas key`, actionIndex, txHash, blockHash);
  }
};
var DelegateActionMustBeOnlyOneActionError = class extends ActionExecutionError {
  constructor(actionIndex, txHash, blockHash) {
    super(`Delegate action must be the only action in transaction`, actionIndex, txHash, blockHash);
  }
};
var UnsupportedProtocolFeatureActionError = class extends ActionExecutionError {
  constructor(feature, version, actionIndex, txHash, blockHash) {
    super(`Unsupported protocol feature ${feature} (version ${version})`, actionIndex, txHash, blockHash);
  }
};
var InvalidDeterministicStateInitReceiverActionError = class extends ActionExecutionError {
  constructor(derived, receiver, actionIndex, txHash, blockHash) {
    super(
      `Invalid deterministic state init receiver ${receiver} (derived ${derived})`,
      actionIndex,
      txHash,
      blockHash
    );
  }
};
var DeterministicStateInitKeyLengthExceededActionError = class extends ActionExecutionError {
  constructor(length, limit, actionIndex, txHash, blockHash) {
    super(`Deterministic state init key length ${length} exceeds limit ${limit}`, actionIndex, txHash, blockHash);
  }
};
var DeterministicStateInitValueLengthExceededActionError = class extends ActionExecutionError {
  constructor(length, limit, actionIndex, txHash, blockHash) {
    super(`Deterministic state init value length ${length} exceeds limit ${limit}`, actionIndex, txHash, blockHash);
  }
};
var GasKeyInvalidNumNoncesActionError = class extends ActionExecutionError {
  constructor(limit, requested, actionIndex, txHash, blockHash) {
    super(`Requested ${requested} gas key nonces, must be between 1 and ${limit}`, actionIndex, txHash, blockHash);
    this.limit = limit;
    this.requested = requested;
  }
};
var AddGasKeyWithNonZeroBalanceActionError = class extends ActionExecutionError {
  constructor(balance, actionIndex, txHash, blockHash) {
    super(`Gas key must be added with zero balance (got ${balance})`, actionIndex, txHash, blockHash);
    this.balance = balance;
  }
};
var TotalNumberOfDeployActionsExceededActionError = class extends ActionExecutionError {
  constructor(limit, numberOfDeployActions, actionIndex, txHash, blockHash) {
    super(
      `Number of deploy actions ${numberOfDeployActions} exceeds limit ${limit}`,
      actionIndex,
      txHash,
      blockHash
    );
    this.limit = limit;
    this.numberOfDeployActions = numberOfDeployActions;
  }
};
var InvalidSignerIdError = class extends TransactionExecutionError {
  constructor(signerId, txHash, blockHash) {
    super(`Invalid signer ID: ${signerId}`, txHash, blockHash);
    this.signerId = signerId;
  }
};
var SignerDoesNotExistError = class extends TransactionExecutionError {
  constructor(signerId, txHash, blockHash) {
    super(`Signer ${signerId} does not exist`, txHash, blockHash);
    this.signerId = signerId;
  }
};
var InvalidNonceError = class extends TransactionExecutionError {
  constructor(accessKeyNonce, transactionNonce, txHash, blockHash) {
    super(`Invalid nonce (ak: ${accessKeyNonce}, tx: ${transactionNonce})`, txHash, blockHash);
    this.accessKeyNonce = accessKeyNonce;
    this.transactionNonce = transactionNonce;
  }
};
var NonceTooLargeError = class extends TransactionExecutionError {
  constructor(transactionNonce, upperBound, txHash, blockHash) {
    super(`Transaction nonce ${transactionNonce} exceeds upper bound ${upperBound}`, txHash, blockHash);
    this.transactionNonce = transactionNonce;
    this.upperBound = upperBound;
  }
};
var InvalidReceiverIdError = class extends TransactionExecutionError {
  constructor(receiverId, txHash, blockHash) {
    super(`Invalid receiver ID: ${receiverId}`, txHash, blockHash);
    this.receiverId = receiverId;
  }
};
var InvalidSignatureError = class extends TransactionExecutionError {
  constructor(txHash, blockHash) {
    super(`Invalid transaction signature`, txHash, blockHash);
  }
};
var NotEnoughBalanceError = class extends TransactionExecutionError {
  constructor(balance, cost, signerId, txHash, blockHash) {
    super(`Not enough balance for ${signerId} (balance: ${balance}, cost: ${cost})`, txHash, blockHash);
    this.balance = balance;
    this.cost = cost;
    this.signerId = signerId;
  }
};
var InvalidNonceIndexError = class extends TransactionExecutionError {
  constructor(numNonces, txNonceIndex, txHash, blockHash) {
    super(`Invalid nonce index ${txNonceIndex} for key with ${numNonces} nonces`, txHash, blockHash);
    this.numNonces = numNonces;
    this.txNonceIndex = txNonceIndex;
  }
};
var NotEnoughGasKeyBalanceError = class extends TransactionExecutionError {
  constructor(balance, cost, signerId, txHash, blockHash) {
    super(`Not enough gas key balance for ${signerId} (balance: ${balance}, cost: ${cost})`, txHash, blockHash);
    this.balance = balance;
    this.cost = cost;
    this.signerId = signerId;
  }
};
var NotEnoughBalanceForDepositError = class extends TransactionExecutionError {
  constructor(balance, cost, signerId, reason, txHash, blockHash) {
    super(
      `Not enough balance for deposit for ${signerId} (balance: ${balance}, cost: ${cost}, reason: ${reason})`,
      txHash,
      blockHash
    );
    this.balance = balance;
    this.cost = cost;
    this.signerId = signerId;
    this.reason = reason;
  }
};
var CostOverflowError = class extends TransactionExecutionError {
  constructor(txHash, blockHash) {
    super(`Transaction cost overflow`, txHash, blockHash);
  }
};
var InvalidChainError = class extends TransactionExecutionError {
  constructor(txHash, blockHash) {
    super(`Invalid chain ID`, txHash, blockHash);
  }
};
var TransactionExpiredError = class extends TransactionExecutionError {
  constructor(txHash, blockHash) {
    super(`Transaction expired`, txHash, blockHash);
  }
};
var TransactionSizeExceededError = class extends TransactionExecutionError {
  constructor(limit, size, txHash, blockHash) {
    super(`Transaction size ${size} exceeds limit ${limit}`, txHash, blockHash);
    this.limit = limit;
    this.size = size;
  }
};
var InvalidTransactionVersionError = class extends TransactionExecutionError {
  constructor(txHash, blockHash) {
    super(`Invalid transaction version`, txHash, blockHash);
  }
};
var StorageInternalError = class extends TransactionExecutionError {
  constructor(txHash, blockHash) {
    super(`Internal storage error`, txHash, blockHash);
  }
};
var MissingTrieValueError = class extends TransactionExecutionError {
  constructor(context, hash, txHash, blockHash) {
    super(`Missing trie value ${hash}`, txHash, blockHash);
    this.context = context;
    this.hash = hash;
  }
};
var UnexpectedTrieValueError = class extends TransactionExecutionError {
  constructor(txHash, blockHash) {
    super(`Unexpected trie value`, txHash, blockHash);
  }
};
var StorageInconsistentStateError = class extends TransactionExecutionError {
  constructor(details, txHash, blockHash) {
    super(`Storage inconsistent state: ${details}`, txHash, blockHash);
    this.details = details;
  }
};
var FlatStorageBlockNotSupportedError = class extends TransactionExecutionError {
  constructor(details, txHash, blockHash) {
    super(`Flat storage block not supported: ${details}`, txHash, blockHash);
    this.details = details;
  }
};
var MemTrieLoadingError = class extends TransactionExecutionError {
  constructor(details, txHash, blockHash) {
    super(`MemTrie loading error: ${details}`, txHash, blockHash);
    this.details = details;
  }
};
var ShardCongestedError = class extends TransactionExecutionError {
  constructor(congestionLevel, shardId, txHash, blockHash) {
    super(`Shard ${shardId} congested (level: ${congestionLevel})`, txHash, blockHash);
    this.congestionLevel = congestionLevel;
    this.shardId = shardId;
  }
};
var ShardStuckError = class extends TransactionExecutionError {
  constructor(missedChunks, shardId, txHash, blockHash) {
    super(`Shard ${shardId} stuck (missed chunks: ${missedChunks})`, txHash, blockHash);
    this.missedChunks = missedChunks;
    this.shardId = shardId;
  }
};

// node_modules/.pnpm/borsh@2.0.0/node_modules/borsh/lib/esm/types.js
var integers = ["u8", "u16", "u32", "u64", "u128", "i8", "i16", "i32", "i64", "i128", "f32", "f64"];

// node_modules/.pnpm/borsh@2.0.0/node_modules/borsh/lib/esm/buffer.js
var EncodeBuffer = (
  /** @class */
  (function() {
    function EncodeBuffer2() {
      this.offset = 0;
      this.buffer_size = 256;
      this.buffer = new ArrayBuffer(this.buffer_size);
      this.view = new DataView(this.buffer);
    }
    EncodeBuffer2.prototype.resize_if_necessary = function(needed_space) {
      if (this.buffer_size - this.offset < needed_space) {
        this.buffer_size = Math.max(this.buffer_size * 2, this.buffer_size + needed_space);
        var new_buffer = new ArrayBuffer(this.buffer_size);
        new Uint8Array(new_buffer).set(new Uint8Array(this.buffer));
        this.buffer = new_buffer;
        this.view = new DataView(new_buffer);
      }
    };
    EncodeBuffer2.prototype.get_used_buffer = function() {
      return new Uint8Array(this.buffer).slice(0, this.offset);
    };
    EncodeBuffer2.prototype.store_value = function(value, type) {
      var bSize = type.substring(1);
      var size = parseInt(bSize) / 8;
      this.resize_if_necessary(size);
      var toCall = type[0] === "f" ? "setFloat".concat(bSize) : type[0] === "i" ? "setInt".concat(bSize) : "setUint".concat(bSize);
      this.view[toCall](this.offset, value, true);
      this.offset += size;
    };
    EncodeBuffer2.prototype.store_bytes = function(from) {
      this.resize_if_necessary(from.length);
      new Uint8Array(this.buffer).set(new Uint8Array(from), this.offset);
      this.offset += from.length;
    };
    return EncodeBuffer2;
  })()
);
var DecodeBuffer = (
  /** @class */
  (function() {
    function DecodeBuffer2(buf) {
      this.offset = 0;
      this.buffer_size = buf.length;
      this.buffer = new ArrayBuffer(buf.length);
      new Uint8Array(this.buffer).set(buf);
      this.view = new DataView(this.buffer);
    }
    DecodeBuffer2.prototype.assert_enough_buffer = function(size) {
      if (this.offset + size > this.buffer.byteLength) {
        throw new Error("Error in schema, the buffer is smaller than expected");
      }
    };
    DecodeBuffer2.prototype.consume_value = function(type) {
      var bSize = type.substring(1);
      var size = parseInt(bSize) / 8;
      this.assert_enough_buffer(size);
      var toCall = type[0] === "f" ? "getFloat".concat(bSize) : type[0] === "i" ? "getInt".concat(bSize) : "getUint".concat(bSize);
      var ret = this.view[toCall](this.offset, true);
      this.offset += size;
      return ret;
    };
    DecodeBuffer2.prototype.consume_bytes = function(size) {
      this.assert_enough_buffer(size);
      var ret = this.buffer.slice(this.offset, this.offset + size);
      this.offset += size;
      return ret;
    };
    return DecodeBuffer2;
  })()
);

// node_modules/.pnpm/borsh@2.0.0/node_modules/borsh/lib/esm/utils.js
var __extends = /* @__PURE__ */ (function() {
  var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
      d2.__proto__ = b2;
    } || function(d2, b2) {
      for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
    };
    return extendStatics(d, b);
  };
  return function(d, b) {
    if (typeof b !== "function" && b !== null)
      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
})();
function isArrayLike(value) {
  return Array.isArray(value) || !!value && typeof value === "object" && "length" in value && typeof value.length === "number" && (value.length === 0 || value.length > 0 && value.length - 1 in value);
}
function expect_type(value, type, fieldPath) {
  if (typeof value !== type) {
    throw new Error("Expected ".concat(type, " not ").concat(typeof value, "(").concat(value, ") at ").concat(fieldPath.join(".")));
  }
}
function expect_bigint(value, fieldPath) {
  var basicType = ["number", "string", "bigint", "boolean"].includes(typeof value);
  var strObject = typeof value === "object" && value !== null && "toString" in value;
  if (!basicType && !strObject) {
    throw new Error("Expected bigint, number, boolean or string not ".concat(typeof value, "(").concat(value, ") at ").concat(fieldPath.join(".")));
  }
}
function expect_same_size(length, expected, fieldPath) {
  if (length !== expected) {
    throw new Error("Array length ".concat(length, " does not match schema length ").concat(expected, " at ").concat(fieldPath.join(".")));
  }
}
function expect_enum(value, fieldPath) {
  if (typeof value !== "object" || value === null) {
    throw new Error("Expected object not ".concat(typeof value, "(").concat(value, ") at ").concat(fieldPath.join(".")));
  }
}
var VALID_STRING_TYPES = integers.concat(["bool", "string"]);
var VALID_OBJECT_KEYS = ["option", "enum", "array", "set", "map", "struct"];
var ErrorSchema = (
  /** @class */
  (function(_super) {
    __extends(ErrorSchema2, _super);
    function ErrorSchema2(schema, expected) {
      var message = "Invalid schema: ".concat(JSON.stringify(schema), " expected ").concat(expected);
      return _super.call(this, message) || this;
    }
    return ErrorSchema2;
  })(Error)
);
function validate_schema(schema) {
  if (typeof schema === "string" && VALID_STRING_TYPES.includes(schema)) {
    return;
  }
  if (schema && typeof schema === "object") {
    var keys = Object.keys(schema);
    if (keys.length === 1 && VALID_OBJECT_KEYS.includes(keys[0])) {
      var key = keys[0];
      if (key === "option")
        return validate_schema(schema[key]);
      if (key === "enum")
        return validate_enum_schema(schema[key]);
      if (key === "array")
        return validate_array_schema(schema[key]);
      if (key === "set")
        return validate_schema(schema[key]);
      if (key === "map")
        return validate_map_schema(schema[key]);
      if (key === "struct")
        return validate_struct_schema(schema[key]);
    }
  }
  throw new ErrorSchema(schema, VALID_OBJECT_KEYS.join(", ") + " or " + VALID_STRING_TYPES.join(", "));
}
function validate_enum_schema(schema) {
  if (!Array.isArray(schema))
    throw new ErrorSchema(schema, "Array");
  for (var _i = 0, schema_1 = schema; _i < schema_1.length; _i++) {
    var sch = schema_1[_i];
    if (typeof sch !== "object" || !("struct" in sch)) {
      throw new Error('Missing "struct" key in enum schema');
    }
    if (typeof sch.struct !== "object" || Object.keys(sch.struct).length !== 1) {
      throw new Error('The "struct" in each enum must have a single key');
    }
    validate_schema({ struct: sch.struct });
  }
}
function validate_array_schema(schema) {
  if (typeof schema !== "object")
    throw new ErrorSchema(schema, "{ type, len? }");
  if (schema.len && typeof schema.len !== "number") {
    throw new Error("Invalid schema: ".concat(schema));
  }
  if ("type" in schema)
    return validate_schema(schema.type);
  throw new ErrorSchema(schema, "{ type, len? }");
}
function validate_map_schema(schema) {
  if (typeof schema === "object" && "key" in schema && "value" in schema) {
    validate_schema(schema.key);
    validate_schema(schema.value);
  } else {
    throw new ErrorSchema(schema, "{ key, value }");
  }
}
function validate_struct_schema(schema) {
  if (typeof schema !== "object")
    throw new ErrorSchema(schema, "object");
  for (var key in schema) {
    validate_schema(schema[key]);
  }
}

// node_modules/.pnpm/borsh@2.0.0/node_modules/borsh/lib/esm/serialize.js
var BorshSerializer = (
  /** @class */
  (function() {
    function BorshSerializer2(checkTypes) {
      this.encoded = new EncodeBuffer();
      this.fieldPath = ["value"];
      this.checkTypes = checkTypes;
    }
    BorshSerializer2.prototype.encode = function(value, schema) {
      this.encode_value(value, schema);
      return this.encoded.get_used_buffer();
    };
    BorshSerializer2.prototype.encode_value = function(value, schema) {
      if (typeof schema === "string") {
        if (integers.includes(schema))
          return this.encode_integer(value, schema);
        if (schema === "string")
          return this.encode_string(value);
        if (schema === "bool")
          return this.encode_boolean(value);
      }
      if (typeof schema === "object") {
        if ("option" in schema)
          return this.encode_option(value, schema);
        if ("enum" in schema)
          return this.encode_enum(value, schema);
        if ("array" in schema)
          return this.encode_array(value, schema);
        if ("set" in schema)
          return this.encode_set(value, schema);
        if ("map" in schema)
          return this.encode_map(value, schema);
        if ("struct" in schema)
          return this.encode_struct(value, schema);
      }
    };
    BorshSerializer2.prototype.encode_integer = function(value, schema) {
      var size = parseInt(schema.substring(1));
      if (size <= 32 || schema == "f64") {
        this.checkTypes && expect_type(value, "number", this.fieldPath);
        this.encoded.store_value(value, schema);
      } else {
        this.checkTypes && expect_bigint(value, this.fieldPath);
        this.encode_bigint(BigInt(value), size);
      }
    };
    BorshSerializer2.prototype.encode_bigint = function(value, size) {
      var buffer_len = size / 8;
      var buffer = new Uint8Array(buffer_len);
      for (var i = 0; i < buffer_len; i++) {
        buffer[i] = Number(value & BigInt(255));
        value = value >> BigInt(8);
      }
      this.encoded.store_bytes(new Uint8Array(buffer));
    };
    BorshSerializer2.prototype.encode_string = function(value) {
      this.checkTypes && expect_type(value, "string", this.fieldPath);
      var _value = value;
      var utf8Bytes = [];
      for (var i = 0; i < _value.length; i++) {
        var charCode = _value.charCodeAt(i);
        if (charCode < 128) {
          utf8Bytes.push(charCode);
        } else if (charCode < 2048) {
          utf8Bytes.push(192 | charCode >> 6, 128 | charCode & 63);
        } else if (charCode < 55296 || charCode >= 57344) {
          utf8Bytes.push(224 | charCode >> 12, 128 | charCode >> 6 & 63, 128 | charCode & 63);
        } else {
          i++;
          charCode = 65536 + ((charCode & 1023) << 10 | _value.charCodeAt(i) & 1023);
          utf8Bytes.push(240 | charCode >> 18, 128 | charCode >> 12 & 63, 128 | charCode >> 6 & 63, 128 | charCode & 63);
        }
      }
      this.encoded.store_value(utf8Bytes.length, "u32");
      this.encoded.store_bytes(new Uint8Array(utf8Bytes));
    };
    BorshSerializer2.prototype.encode_boolean = function(value) {
      this.checkTypes && expect_type(value, "boolean", this.fieldPath);
      this.encoded.store_value(value ? 1 : 0, "u8");
    };
    BorshSerializer2.prototype.encode_option = function(value, schema) {
      if (value === null || value === void 0) {
        this.encoded.store_value(0, "u8");
      } else {
        this.encoded.store_value(1, "u8");
        this.encode_value(value, schema.option);
      }
    };
    BorshSerializer2.prototype.encode_enum = function(value, schema) {
      this.checkTypes && expect_enum(value, this.fieldPath);
      var valueKey = Object.keys(value)[0];
      for (var i = 0; i < schema["enum"].length; i++) {
        var valueSchema = schema["enum"][i];
        if (valueKey === Object.keys(valueSchema.struct)[0]) {
          this.encoded.store_value(i, "u8");
          return this.encode_struct(value, valueSchema);
        }
      }
      throw new Error("Enum key (".concat(valueKey, ") not found in enum schema: ").concat(JSON.stringify(schema), " at ").concat(this.fieldPath.join(".")));
    };
    BorshSerializer2.prototype.encode_array = function(value, schema) {
      if (isArrayLike(value))
        return this.encode_arraylike(value, schema);
      if (value instanceof ArrayBuffer)
        return this.encode_buffer(value, schema);
      throw new Error("Expected Array-like not ".concat(typeof value, "(").concat(value, ") at ").concat(this.fieldPath.join(".")));
    };
    BorshSerializer2.prototype.encode_arraylike = function(value, schema) {
      if (schema.array.len) {
        expect_same_size(value.length, schema.array.len, this.fieldPath);
      } else {
        this.encoded.store_value(value.length, "u32");
      }
      for (var i = 0; i < value.length; i++) {
        this.encode_value(value[i], schema.array.type);
      }
    };
    BorshSerializer2.prototype.encode_buffer = function(value, schema) {
      if (schema.array.len) {
        expect_same_size(value.byteLength, schema.array.len, this.fieldPath);
      } else {
        this.encoded.store_value(value.byteLength, "u32");
      }
      this.encoded.store_bytes(new Uint8Array(value));
    };
    BorshSerializer2.prototype.encode_set = function(value, schema) {
      this.checkTypes && expect_type(value, "object", this.fieldPath);
      var isSet = value instanceof Set;
      var values = isSet ? Array.from(value.values()) : Object.values(value);
      this.encoded.store_value(values.length, "u32");
      for (var _i = 0, values_1 = values; _i < values_1.length; _i++) {
        var value_1 = values_1[_i];
        this.encode_value(value_1, schema.set);
      }
    };
    BorshSerializer2.prototype.encode_map = function(value, schema) {
      this.checkTypes && expect_type(value, "object", this.fieldPath);
      var isMap = value instanceof Map;
      var keys = isMap ? Array.from(value.keys()) : Object.keys(value);
      this.encoded.store_value(keys.length, "u32");
      for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        this.encode_value(key, schema.map.key);
        this.encode_value(isMap ? value.get(key) : value[key], schema.map.value);
      }
    };
    BorshSerializer2.prototype.encode_struct = function(value, schema) {
      this.checkTypes && expect_type(value, "object", this.fieldPath);
      for (var _i = 0, _a = Object.keys(schema.struct); _i < _a.length; _i++) {
        var key = _a[_i];
        this.fieldPath.push(key);
        this.encode_value(value[key], schema.struct[key]);
        this.fieldPath.pop();
      }
    };
    return BorshSerializer2;
  })()
);

// node_modules/.pnpm/borsh@2.0.0/node_modules/borsh/lib/esm/deserialize.js
var BorshDeserializer = (
  /** @class */
  (function() {
    function BorshDeserializer2(bufferArray) {
      this.buffer = new DecodeBuffer(bufferArray);
    }
    BorshDeserializer2.prototype.decode = function(schema) {
      return this.decode_value(schema);
    };
    BorshDeserializer2.prototype.decode_value = function(schema) {
      if (typeof schema === "string") {
        if (integers.includes(schema))
          return this.decode_integer(schema);
        if (schema === "string")
          return this.decode_string();
        if (schema === "bool")
          return this.decode_boolean();
      }
      if (typeof schema === "object") {
        if ("option" in schema)
          return this.decode_option(schema);
        if ("enum" in schema)
          return this.decode_enum(schema);
        if ("array" in schema)
          return this.decode_array(schema);
        if ("set" in schema)
          return this.decode_set(schema);
        if ("map" in schema)
          return this.decode_map(schema);
        if ("struct" in schema)
          return this.decode_struct(schema);
      }
      throw new Error("Unsupported type: ".concat(schema));
    };
    BorshDeserializer2.prototype.decode_integer = function(schema) {
      var size = parseInt(schema.substring(1));
      if (size <= 32 || schema == "f64") {
        return this.buffer.consume_value(schema);
      }
      return this.decode_bigint(size, schema.startsWith("i"));
    };
    BorshDeserializer2.prototype.decode_bigint = function(size, signed) {
      if (signed === void 0) {
        signed = false;
      }
      var buffer_len = size / 8;
      var buffer = new Uint8Array(this.buffer.consume_bytes(buffer_len));
      var bits = buffer.reduceRight(function(r, x) {
        return r + x.toString(16).padStart(2, "0");
      }, "");
      if (signed && buffer[buffer_len - 1]) {
        return BigInt.asIntN(size, BigInt("0x".concat(bits)));
      }
      return BigInt("0x".concat(bits));
    };
    BorshDeserializer2.prototype.decode_string = function() {
      var len = this.decode_integer("u32");
      var buffer = new Uint8Array(this.buffer.consume_bytes(len));
      var codePoints = [];
      for (var i = 0; i < len; ++i) {
        var byte = buffer[i];
        if (byte < 128) {
          codePoints.push(byte);
        } else if (byte < 224) {
          codePoints.push((byte & 31) << 6 | buffer[++i] & 63);
        } else if (byte < 240) {
          codePoints.push((byte & 15) << 12 | (buffer[++i] & 63) << 6 | buffer[++i] & 63);
        } else {
          var codePoint = (byte & 7) << 18 | (buffer[++i] & 63) << 12 | (buffer[++i] & 63) << 6 | buffer[++i] & 63;
          codePoints.push(codePoint);
        }
      }
      return String.fromCodePoint.apply(String, codePoints);
    };
    BorshDeserializer2.prototype.decode_boolean = function() {
      return this.buffer.consume_value("u8") > 0;
    };
    BorshDeserializer2.prototype.decode_option = function(schema) {
      var option = this.buffer.consume_value("u8");
      if (option === 1) {
        return this.decode_value(schema.option);
      }
      if (option !== 0) {
        throw new Error("Invalid option ".concat(option));
      }
      return null;
    };
    BorshDeserializer2.prototype.decode_enum = function(schema) {
      var _a;
      var valueIndex = this.buffer.consume_value("u8");
      if (valueIndex > schema["enum"].length) {
        throw new Error("Enum option ".concat(valueIndex, " is not available"));
      }
      var struct = schema["enum"][valueIndex].struct;
      var key = Object.keys(struct)[0];
      return _a = {}, _a[key] = this.decode_value(struct[key]), _a;
    };
    BorshDeserializer2.prototype.decode_array = function(schema) {
      var result = [];
      var len = schema.array.len ? schema.array.len : this.decode_integer("u32");
      for (var i = 0; i < len; ++i) {
        result.push(this.decode_value(schema.array.type));
      }
      return result;
    };
    BorshDeserializer2.prototype.decode_set = function(schema) {
      var len = this.decode_integer("u32");
      var result = /* @__PURE__ */ new Set();
      for (var i = 0; i < len; ++i) {
        result.add(this.decode_value(schema.set));
      }
      return result;
    };
    BorshDeserializer2.prototype.decode_map = function(schema) {
      var len = this.decode_integer("u32");
      var result = /* @__PURE__ */ new Map();
      for (var i = 0; i < len; ++i) {
        var key = this.decode_value(schema.map.key);
        var value = this.decode_value(schema.map.value);
        result.set(key, value);
      }
      return result;
    };
    BorshDeserializer2.prototype.decode_struct = function(schema) {
      var result = {};
      for (var key in schema.struct) {
        result[key] = this.decode_value(schema.struct[key]);
      }
      return result;
    };
    return BorshDeserializer2;
  })()
);

// node_modules/.pnpm/borsh@2.0.0/node_modules/borsh/lib/esm/index.js
function serialize(schema, value, validate) {
  if (validate === void 0) {
    validate = true;
  }
  if (validate)
    validate_schema(schema);
  var serializer = new BorshSerializer(validate);
  return serializer.encode(value, schema);
}
function deserialize(schema, buffer, validate) {
  if (validate === void 0) {
    validate = true;
  }
  if (validate)
    validate_schema(schema);
  var deserializer = new BorshDeserializer(buffer);
  return deserializer.decode(schema);
}

// node_modules/.pnpm/near-api-js@7.4.0/node_modules/near-api-js/lib/index.js
var import_is_my_json_valid = __toESM(require_is_my_json_valid(), 1);
var KeySize = {
  SECRET_KEY: 32,
  ED25519_PUBLIC_KEY: 32,
  SECP256k1_PUBLIC_KEY: 64,
  MLDSA65_PUBLIC_KEY: 1952,
  MLDSA65_SIGNATURE: 3309
};
var KeyPairBase = class {
};
var NEAR_NOMINATION_EXP = 24;
var NEAR_NOMINATION = 10n ** BigInt(NEAR_NOMINATION_EXP);
var ROUNDING_OFFSETS = [];
var BN10 = 10n;
for (let i = 0, offset = 5n; i < NEAR_NOMINATION_EXP; i++, offset = offset * BN10) {
  ROUNDING_OFFSETS[i] = offset;
}
function baseEncode(value) {
  if (typeof value === "string") {
    const bytes = [];
    for (let c = 0; c < value.length; c++) {
      bytes.push(value.charCodeAt(c));
    }
    value = new Uint8Array(bytes);
  }
  return base58.encode(value);
}
function baseDecode(value) {
  return base58.decode(value);
}
function base64Encode(bytes) {
  return base64.encode(bytes);
}
function base64Decode(str) {
  return base64.decode(str);
}
var encoder = new TextEncoder();
var decoder = new TextDecoder();
function stringToBytes(str) {
  return encoder.encode(str);
}
function bytesToString(bytes) {
  return decoder.decode(bytes);
}
function getTransactionLastResult(txResult) {
  if (typeof txResult.status === "object" && txResult.status !== null && "SuccessValue" in txResult.status && typeof txResult.status.SuccessValue === "string") {
    const value = bytesToString(base64Decode(txResult.status.SuccessValue));
    try {
      return JSON.parse(value);
    } catch (e) {
      return value;
    }
  }
  return null;
}
function sortBigIntAsc(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
function findSeatPrice(validators, maxNumberOfSeats, minimumStakeRatio, protocolVersion) {
  if (protocolVersion && protocolVersion < 49) {
    return findSeatPriceForProtocolBefore49(validators, maxNumberOfSeats);
  }
  if (!minimumStakeRatio) {
    console.warn(
      "DeprecationWarning: findSeatPrice(validators, maxNumberOfSeats) is deprecated. Use findSeatPrice(validators, maxNumberOfSeats, minimumStakeRatio) instead."
    );
    minimumStakeRatio = [1, 6250];
  }
  return findSeatPriceForProtocolAfter49(validators, maxNumberOfSeats, minimumStakeRatio);
}
function findSeatPriceForProtocolBefore49(validators, numSeats) {
  const stakes = validators.map((v) => BigInt(v.stake)).sort(sortBigIntAsc);
  const num = BigInt(numSeats);
  const stakesSum = stakes.reduce((a, b) => a + b);
  if (stakesSum < num) {
    throw new Error("Stakes are below seats");
  }
  let left = 1n, right = stakesSum + 1n;
  while (left !== right - 1n) {
    const mid = (left + right) / 2n;
    let found = false;
    let currentSum = 0n;
    for (let i = 0; i < stakes.length; ++i) {
      currentSum = currentSum + stakes[i] / mid;
      if (currentSum >= num) {
        left = mid;
        found = true;
        break;
      }
    }
    if (!found) {
      right = mid;
    }
  }
  return left;
}
function findSeatPriceForProtocolAfter49(validators, maxNumberOfSeats, minimumStakeRatio) {
  if (minimumStakeRatio.length != 2) {
    throw Error("minimumStakeRatio should have 2 elements");
  }
  const stakes = validators.map((v) => BigInt(v.stake)).sort(sortBigIntAsc);
  const stakesSum = stakes.reduce((a, b) => a + b);
  if (validators.length < maxNumberOfSeats) {
    return stakesSum * BigInt(minimumStakeRatio[0]) / BigInt(minimumStakeRatio[1]);
  } else if (stakes.length > 0) {
    return stakes[0] + 1n;
  } else {
    throw new Error(`Unreachable`);
  }
}
function key_type_to_str(keyType) {
  switch (keyType) {
    case 0:
      return "ed25519";
    case 1:
      return "secp256k1";
    case 2:
      return "ml-dsa-65";
    default:
      throw new Error(`Unknown key type ${keyType}`);
  }
}
function str_to_key_type(keyType) {
  switch (keyType.toLowerCase()) {
    case "ed25519":
      return 0;
    case "secp256k1":
      return 1;
    case "ml-dsa-65":
      return 2;
    default:
      throw new Error(`Unknown key type ${keyType}`);
  }
}
function resolveEnumKeyName(keyType) {
  switch (keyType) {
    case 0: {
      return "ed25519Key";
    }
    case 1: {
      return "secp256k1Key";
    }
    case 2: {
      return "mlDsa65Key";
    }
    default: {
      throw Error(`unknown type ${keyType}`);
    }
  }
}
var Enum = class {
  constructor(properties) {
    if (Object.keys(properties).length !== 1) {
      throw new Error("Enum can only take single value");
    }
    Object.keys(properties).forEach((key) => {
      this[key] = properties[key];
    });
  }
};
var PublicKey = class _PublicKey extends Enum {
  constructor(publicKey) {
    const keyName = resolveEnumKeyName(publicKey.keyType);
    super({ [keyName]: publicKey });
    this[keyName] = publicKey;
    this.enum = keyName;
  }
  static from(value) {
    if (typeof value === "string") {
      return _PublicKey.fromString(value);
    }
    if (value instanceof _PublicKey) {
      return value;
    }
    if (typeof value === "object" && value !== null) {
      const maybeEd25519 = value["ed25519Key"];
      if (typeof maybeEd25519 === "object" && maybeEd25519 !== null && "data" in maybeEd25519) {
        return new _PublicKey({
          keyType: 0,
          data: Uint8Array.from(maybeEd25519.data)
        });
      }
      const maybeSecp256k1 = value["secp256k1Key"];
      if (typeof maybeSecp256k1 === "object" && maybeSecp256k1 !== null && "data" in maybeSecp256k1) {
        return new _PublicKey({
          keyType: 1,
          data: Uint8Array.from(maybeSecp256k1.data)
        });
      }
      const maybeMlDsa65 = value["mlDsa65Key"];
      if (typeof maybeMlDsa65 === "object" && maybeMlDsa65 !== null && "data" in maybeMlDsa65) {
        return new _PublicKey({
          keyType: 2,
          data: Uint8Array.from(maybeMlDsa65.data)
        });
      }
    }
    throw new Error("Unsupported public key format");
  }
  /**
   * Creates a PublicKey instance from an encoded key string.
   * @param encodedKey The encoded key string.
   * @returns {PublicKey} The PublicKey instance created from the encoded key string.
   */
  static fromString(encodedKey) {
    const parts = encodedKey.split(":");
    let publicKey;
    let keyType;
    if (parts.length === 1) {
      publicKey = parts[0];
    } else if (parts.length === 2) {
      publicKey = parts[1];
      keyType = str_to_key_type(parts[0]);
    } else {
      throw new Error("Invalid encoded key format, must be <curve>:<encoded key>");
    }
    const decodedPublicKey = baseDecode(publicKey);
    if (!keyType) {
      keyType = decodedPublicKey.length === KeySize.SECP256k1_PUBLIC_KEY ? 1 : 0;
    }
    const keySize = keyType === 0 ? KeySize.ED25519_PUBLIC_KEY : keyType === 1 ? KeySize.SECP256k1_PUBLIC_KEY : KeySize.MLDSA65_PUBLIC_KEY;
    if (decodedPublicKey.length !== keySize) {
      throw new Error(`Invalid public key size (${decodedPublicKey.length}), must be ${keySize}`);
    }
    return new _PublicKey({ keyType, data: decodedPublicKey });
  }
  /**
   * Returns a string representation of the public key.
   * @returns {string} The string representation of the public key.
   */
  toString() {
    const encodedKey = baseEncode(this.data);
    return `${key_type_to_str(this.keyType)}:${encodedKey}`;
  }
  /**
   * Verifies a message signature using the public key.
   * @param message The message to be verified.
   * @param signature The signature to be verified.
   * @returns {boolean} `true` if the signature is valid, otherwise `false`.
   */
  verify(message, signature) {
    const keyType = this.keyType;
    const data = this.data;
    switch (keyType) {
      case 0:
        return ed25519.verify(signature, message, data);
      case 1:
        return secp256k1.verify(signature.subarray(0, 64), message, new Uint8Array([4, ...data]), {
          prehash: false
        });
      case 2:
        return ml_dsa65.verify(signature, message, data);
      default:
        throw new Error(`Unknown key type: ${keyType}`);
    }
  }
  get keyPair() {
    return this.ed25519Key || this.secp256k1Key || this.mlDsa65Key;
  }
  get keyType() {
    if (typeof this.keyPair === "undefined") throw new Error(`Property 'keyPair' of PublicKey is undefined`);
    return this.keyPair.keyType;
  }
  get data() {
    if (typeof this.keyPair === "undefined") throw new Error(`Property 'keyPair' of PublicKey is undefined`);
    return this.keyPair.data;
  }
};
var KeyPairEd25519 = class _KeyPairEd25519 extends KeyPairBase {
  /**
   * Construct an instance of key pair given a secret key.
   * It's generally assumed that these are encoded in base58.
   * @param extendedSecretKey
   */
  constructor(extendedSecretKey) {
    super();
    const decoded = baseDecode(extendedSecretKey);
    const secretKey = new Uint8Array(decoded.slice(0, KeySize.SECRET_KEY));
    const publicKey = ed25519.getPublicKey(new Uint8Array(secretKey));
    this.publicKey = new PublicKey({ keyType: 0, data: publicKey });
    this.secretKey = baseEncode(secretKey);
    this.extendedSecretKey = extendedSecretKey;
  }
  /**
   * Generate a new random keypair.
   * @example
   * const keyRandom = KeyPair.fromRandom();
   * keyRandom.publicKey
   * // returns [PUBLIC_KEY]
   *
   * keyRandom.secretKey
   * // returns [SECRET_KEY]
   */
  static fromRandom() {
    const secretKey = crypto.getRandomValues(new Uint8Array(KeySize.SECRET_KEY));
    const publicKey = ed25519.getPublicKey(new Uint8Array(secretKey));
    const extendedSecretKey = new Uint8Array([...secretKey, ...publicKey]);
    return new _KeyPairEd25519(baseEncode(extendedSecretKey));
  }
  /**
   * Signs a message using the key pair's secret key.
   * @param message The message to be signed.
   * @returns {Signature} The signature object containing the signature and the public key.
   */
  sign(message) {
    const signature = ed25519.sign(message, baseDecode(this.secretKey));
    return { signature, publicKey: this.publicKey };
  }
  /**
   * Verifies the signature of a message using the key pair's public key.
   * @param message The message to be verified.
   * @param signature The signature to be verified.
   * @returns {boolean} `true` if the signature is valid, otherwise `false`.
   */
  verify(message, signature) {
    return this.publicKey.verify(message, signature);
  }
  /**
   * Returns a string representation of the key pair in the format 'ed25519:[extendedSecretKey]'.
   * @returns {string} The string representation of the key pair.
   */
  toString() {
    return `ed25519:${this.extendedSecretKey}`;
  }
  /**
   * Retrieves the public key associated with the key pair.
   * @returns {PublicKey} The public key.
   */
  getPublicKey() {
    return this.publicKey;
  }
};
var Q2 = 8380417;
var N2 = 256;
var K = 6;
var L = 5;
var ETA = 4;
var D2 = 13;
var POLY_ETA_BYTES = 128;
var POLY_T0_BYTES = 416;
var POLY_T1_BYTES = 320;
var N_INV = 8347681;
var mod2 = (a) => {
  const r = a % Q2;
  return r < 0 ? r + Q2 : r;
};
var mul = (a, b) => a * b % Q2;
var power = (base, exp) => {
  let result = 1;
  let b = base;
  let e = exp;
  while (e > 0) {
    if (e & 1) result = mul(result, b);
    b = mul(b, b);
    e >>= 1;
  }
  return result;
};
var bitReverse8 = (x) => {
  let r = 0;
  for (let i = 0; i < 8; i++) r |= (x >> i & 1) << 7 - i;
  return r;
};
var ZETAS = Array.from({ length: N2 }, (_, i) => power(1753, bitReverse8(i)));
function ntt(input) {
  const w = input.slice();
  let m = 0;
  for (let len = 128; len >= 1; len >>= 1) {
    for (let start = 0; start < N2; start += 2 * len) {
      const zeta = ZETAS[++m];
      for (let j = start; j < start + len; j++) {
        const t = mul(zeta, w[j + len]);
        w[j + len] = mod2(w[j] - t);
        w[j] = mod2(w[j] + t);
      }
    }
  }
  return w;
}
function inverseNtt(input) {
  const w = input.slice();
  let m = N2;
  for (let len = 1; len < N2; len <<= 1) {
    for (let start = 0; start < N2; start += 2 * len) {
      const zeta = mod2(-ZETAS[--m]);
      for (let j = start; j < start + len; j++) {
        const t = w[j];
        w[j] = mod2(t + w[j + len]);
        w[j + len] = mul(zeta, mod2(t - w[j + len]));
      }
    }
  }
  return w.map((x) => mul(x, N_INV));
}
function sampleNttPoly(rho, column, row) {
  const out = [];
  const xof = shake128.create({});
  const input = new Uint8Array(34);
  input.set(rho);
  input[32] = column;
  input[33] = row;
  xof.update(input);
  while (out.length < N2) {
    const b = xof.xof(3);
    const v = b[0] | b[1] << 8 | (b[2] & 127) << 16;
    if (v < Q2) out.push(v);
  }
  return out;
}
function readBits(bytes, offset, index, width) {
  let v = 0;
  for (let b = 0; b < width; b++) {
    const bit = index * width + b;
    v |= (bytes[offset + (bit >> 3)] >> (bit & 7) & 1) << b;
  }
  return v;
}
function unpackEta(bytes, offset) {
  const poly = [];
  for (let i = 0; i < N2; i++) {
    const v = readBits(bytes, offset, i, 4);
    if (v > 2 * ETA) throw new Error("ML-DSA-65 secret key has a coefficient of s1 or s2 outside [-4, 4]");
    poly.push(ETA - v);
  }
  return poly;
}
function assertValidExpandedMLDSA65(secretKey, publicKey) {
  if (secretKey.length !== 4032 || publicKey.length !== 1952) {
    throw new Error("ML-DSA-65 expanded key or public key has the wrong length");
  }
  const rho = secretKey.subarray(0, 32);
  const tr = secretKey.subarray(64, 128);
  const s1 = [];
  const s2 = [];
  for (let i = 0; i < L; i++) s1.push(unpackEta(secretKey, 128 + i * POLY_ETA_BYTES));
  for (let i = 0; i < K; i++) s2.push(unpackEta(secretKey, 128 + (L + i) * POLY_ETA_BYTES));
  const t0Offset = 128 + (L + K) * POLY_ETA_BYTES;
  const s1Hat = s1.map((p) => ntt(p.map(mod2)));
  for (let row = 0; row < K; row++) {
    const acc = new Array(N2).fill(0);
    for (let column = 0; column < L; column++) {
      const a = sampleNttPoly(rho, column, row);
      const s = s1Hat[column];
      for (let j = 0; j < N2; j++) acc[j] = mod2(acc[j] + mul(a[j], s[j]));
    }
    const t = inverseNtt(acc);
    for (let j = 0; j < N2; j++) {
      const r = mod2(t[j] + s2[row][j]);
      let r0 = r % (1 << D2);
      if (r0 > 1 << D2 - 1) r0 -= 1 << D2;
      const t1 = r - r0 >> D2;
      if ((1 << D2 - 1) - readBits(secretKey, t0Offset + row * POLY_T0_BYTES, j, D2) !== r0) {
        throw new Error("ML-DSA-65 secret key t0 does not match rho, s1 and s2");
      }
      if (readBits(publicKey, 32 + row * POLY_T1_BYTES, j, 10) !== t1) {
        throw new Error("ML-DSA-65 public key t1 does not match the secret key");
      }
    }
  }
  for (let i = 0; i < 32; i++) {
    if (publicKey[i] !== rho[i]) throw new Error("ML-DSA-65 public key rho does not match the secret key");
  }
  const expectedTr = shake256(publicKey, { dkLen: 64 });
  for (let i = 0; i < 64; i++) {
    if (expectedTr[i] !== tr[i]) throw new Error("ML-DSA-65 secret key tr does not match the public key");
  }
}
var SEED_LENGTH = 32;
var EXPANDED_LENGTH = 4032;
var KeyPairMLDSA65 = class _KeyPairMLDSA65 extends KeyPairBase {
  constructor(secretKey) {
    super();
    const secretKeyBytes = baseDecode(secretKey);
    if (secretKeyBytes.length === SEED_LENGTH) {
      const expanded = ml_dsa65.keygen(secretKeyBytes);
      this.signingKey = expanded.secretKey;
      this.publicKey = new PublicKey({ keyType: 2, data: expanded.publicKey });
    } else if (secretKeyBytes.length === EXPANDED_LENGTH) {
      const publicKey = ml_dsa65.getPublicKey(secretKeyBytes);
      assertValidExpandedMLDSA65(secretKeyBytes, publicKey);
      this.signingKey = secretKeyBytes;
      this.publicKey = new PublicKey({ keyType: 2, data: publicKey });
    } else {
      throw new Error(
        `ML-DSA-65 secret key must be ${SEED_LENGTH} or ${EXPANDED_LENGTH} bytes, got ${secretKeyBytes.length}`
      );
    }
    this.secretKey = secretKey;
  }
  static fromRandom() {
    return new _KeyPairMLDSA65(baseEncode(randomBytes(SEED_LENGTH)));
  }
  sign(message) {
    return { signature: ml_dsa65.sign(message, this.signingKey), publicKey: this.publicKey };
  }
  verify(message, signature) {
    return this.publicKey.verify(message, signature);
  }
  toString() {
    return `ml-dsa-65:${this.secretKey}`;
  }
  getPublicKey() {
    return this.publicKey;
  }
};
var KeyPairSecp256k1 = class _KeyPairSecp256k1 extends KeyPairBase {
  /**
   * Construct an instance of key pair given a secret key.
   * It's generally assumed that these are encoded in base58.
   * @param {string} extendedSecretKey
   */
  constructor(extendedSecretKey) {
    super();
    const decoded = baseDecode(extendedSecretKey);
    const secretKey = new Uint8Array(decoded.slice(0, KeySize.SECRET_KEY));
    const withHeader = secp256k1.getPublicKey(new Uint8Array(secretKey), false);
    const data = withHeader.subarray(1);
    this.publicKey = new PublicKey({
      keyType: 1,
      data
    });
    this.secretKey = baseEncode(secretKey);
    this.extendedSecretKey = extendedSecretKey;
  }
  /**
   * Generate a new random keypair.
   * @example
   * const keyRandom = KeyPair.fromRandom();
   * keyRandom.publicKey
   * // returns [PUBLIC_KEY]
   *
   * keyRandom.secretKey
   * // returns [SECRET_KEY]
   */
  static fromRandom() {
    const secretKey = crypto.getRandomValues(new Uint8Array(KeySize.SECRET_KEY));
    const withHeader = secp256k1.getPublicKey(secretKey, false);
    const publicKey = withHeader.subarray(1);
    const extendedSecretKey = new Uint8Array([...secretKey, ...publicKey]);
    return new _KeyPairSecp256k1(baseEncode(extendedSecretKey));
  }
  sign(message) {
    const raw = secp256k1.sign(message, baseDecode(this.secretKey), { prehash: false, format: "recovered" });
    const signature = new Uint8Array(65);
    signature.set(raw.subarray(1), 0);
    signature[64] = raw[0];
    return { signature, publicKey: this.publicKey };
  }
  verify(message, signature) {
    return this.publicKey.verify(message, signature);
  }
  toString() {
    return `secp256k1:${this.extendedSecretKey}`;
  }
  getPublicKey() {
    return this.publicKey;
  }
};
var KeyPair = class extends KeyPairBase {
  /**
   * @param curve Name of elliptical curve, case-insensitive
   * @returns Random KeyPair based on the curve
   */
  static fromRandom(curve) {
    switch (curve.toUpperCase()) {
      case "ED25519":
        return KeyPairEd25519.fromRandom();
      case "SECP256K1":
        return KeyPairSecp256k1.fromRandom();
      case "ML-DSA-65":
        return KeyPairMLDSA65.fromRandom();
      default:
        throw new Error(`Unknown curve ${curve}`);
    }
  }
  /**
   * Creates a key pair from an encoded key string.
   * @param encodedKey The encoded key string.
   * @returns {KeyPair} The key pair created from the encoded key string.
   */
  static fromString(encodedKey) {
    const parts = encodedKey.split(":");
    if (parts.length === 2) {
      switch (parts[0].toUpperCase()) {
        case "ED25519":
          return new KeyPairEd25519(parts[1]);
        case "SECP256K1":
          return new KeyPairSecp256k1(parts[1]);
        case "ML-DSA-65":
          return new KeyPairMLDSA65(parts[1]);
        default:
          throw new Error(`Unknown curve: ${parts[0]}`);
      }
    } else {
      throw new Error("Invalid encoded key format, must be <curve>:<encoded key>");
    }
  }
};
function parseRpcError(error) {
  switch (error.name) {
    case "REQUEST_VALIDATION_ERROR": {
      return parseRequestValidationError(error.cause);
    }
    case "HANDLER_ERROR": {
      if (!error.cause) return new RpcError(`Handler error with no cause`);
      return parseHandlerError(error);
    }
    case "INTERNAL_ERROR": {
      return new InternalRpcError(error.cause.info.error_message);
    }
    default:
      error;
      return new RpcError(`Unknown RPC error`);
  }
}
function parseRequestValidationError(error) {
  switch (error.name) {
    case "METHOD_NOT_FOUND":
      return new RpcMethodNotFoundError(error.info.method_name);
    case "PARSE_ERROR":
      return new RpcRequestParseError(error.info.error_message);
    default:
      error;
      return new RpcError("Unknown request validation error");
  }
}
function parseHandlerError(rawError) {
  const error = rawError.cause;
  switch (error.name) {
    case "UNKNOWN_ACCOUNT": {
      return new AccountDoesNotExistError(
        error.info.requested_account_id,
        error.info.block_hash,
        error.info.block_height
      );
    }
    case "UNKNOWN_ACCESS_KEY":
      return new AccessKeyDoesNotExistError(
        PublicKey.fromString(error.info.public_key),
        error.info.block_hash,
        error.info.block_height
      );
    case "NO_CONTRACT_CODE":
      return new ContractCodeDoesNotExistError(
        error.info.contract_account_id,
        error.info.block_hash,
        error.info.block_height
      );
    case "UNKNOWN_BLOCK":
      return new UnknownBlockError(
        "block_reference" in error.info ? error.info.block_reference : void 0
      );
    case "UNKNOWN_GAS_KEY":
      return new GasKeyDoesNotExistError(
        PublicKey.fromString(error.info.public_key),
        error.info.block_hash,
        error.info.block_height
      );
    case "CONTRACT_EXECUTION_ERROR":
      return parseFunctionCallError(
        "error" in error.info ? error.info.error : error.info.vm_error,
        error.info.block_hash,
        error.info.block_height
      );
    case "NO_GLOBAL_CONTRACT_CODE":
      return new GlobalContractCodeDoesNotExistError(
        error.info.identifier,
        error.info.block_hash,
        error.info.block_height
      );
    case "GARBAGE_COLLECTED_BLOCK":
      return new GarbageCollectedBlockError(error.info.block_hash, error.info.block_height);
    case "INVALID_SHARD_ID":
      return new InvalidShardIdError(error.info.shard_id);
    case "UNAVAILABLE_SHARD":
      return new UnavailableShardError(
        "requested_shard_id" in error.info ? error.info.requested_shard_id : error.info.shard_id
      );
    case "INVALID_TRANSACTION":
      if ("data" in rawError && typeof rawError.data === "object" && rawError.data !== null && "TxExecutionError" in rawError.data && typeof rawError.data.TxExecutionError === "object" && rawError.data.TxExecutionError !== null) {
        return parseTransactionExecutionError(rawError.data.TxExecutionError, "", "");
      }
      return new InvalidTransactionError();
    case "UNKNOWN_TRANSACTION":
      return new UnknownTransactionError(error.info.requested_transaction_hash);
    case "TIMEOUT_ERROR":
      return new TransactionTimeoutError();
    case "UNKNOWN_EPOCH":
      return new UnknownEpochError();
    case "EPOCH_OUT_OF_BOUNDS":
      return new EpochOutOfBoundsError(error.info.epoch_id);
    case "NODE_IS_SYNCING":
      return new NodeIsSyncingError();
    case "NO_NEW_BLOCKS":
      return new NoNewBlocksError();
    case "UNKNOWN_RECEIPT":
      return new UnknownReceiptError(error.info.receipt_id);
    case "INTERNAL_ERROR":
      return new InternalHandlerError(
        "error_message" in error.info ? error.info.error_message : error.info.debug_info
      );
    case "NOT_SYNCED_YET":
      return new NotSyncedYetError();
    case "UNKNOWN_CHUNK":
      return new UnknownChunkError(error.info.chunk_hash);
    case "DOES_NOT_TRACK_SHARD":
      return new DoesNotTrackShardError();
    case "REQUEST_ROUTED":
      return new RequestRoutedError(error.info.transaction_hash);
    case "VALIDATOR_INFO_UNAVAILABLE":
      return new ValidatorInfoUnavailableError();
    case "NO_SYNCED_BLOCKS":
      return new NoSyncedBlocksError();
    case "INVALID_ACCOUNT":
      return new InvalidAccountError(
        error.info.requested_account_id,
        error.info.block_hash,
        error.info.block_height
      );
    case "TOO_LARGE_CONTRACT_STATE":
      return new TooLargeContractStateError(
        error.info.contract_account_id,
        error.info.block_hash,
        error.info.block_height
      );
    case "INCONSISTENT_STATE":
      return new InconsistentStateError(error.info.execution_outcome_shard_id, error.info.number_or_shards);
    case "NOT_CONFIRMED":
      return new NotConfirmedError(error.info.transaction_or_receipt_id);
    case "UNKNOWN_TRANSACTION_OR_RECEIPT":
      return new UnknownTransactionOrReceiptError(error.info.transaction_or_receipt_id);
    case "SHARD_NOT_APPLIED":
      return new ShardNotAppliedError(error.info.shard_id);
    default:
      error;
      return new HandlerError("Unknown handler error");
  }
}
function parseFunctionCallError(error, blockHash, blockHeight) {
  if (error === "WasmUnknownError") return new ContractExecutionError("Unknown WASM error", blockHash, blockHeight);
  if (error === "_EVMError") return new ContractExecutionError(error, blockHash, blockHeight);
  if ("CompilationError" in error) {
    if ("CodeDoesNotExist" in error.CompilationError)
      return new ContractCodeDoesNotExistError(
        error.CompilationError.CodeDoesNotExist.account_id,
        blockHash,
        blockHeight
      );
    if ("WasmerCompileError" in error.CompilationError)
      return new ContractExecutionError(error.CompilationError.WasmerCompileError.msg, blockHash, blockHeight);
    if ("PrepareError" in error.CompilationError)
      return new PrepareWasmError(error.CompilationError.PrepareError, blockHash, blockHeight);
    error.CompilationError;
    throw new ContractExecutionError("Unknown compilation error", blockHash, blockHeight);
  }
  if ("MethodResolveError" in error) {
    switch (error.MethodResolveError) {
      case "MethodEmptyName":
        return new ContractMethodNameEmptyError(blockHash, blockHeight);
      case "MethodNotFound":
        return new ContractMethodNotFoundError(blockHash, blockHeight);
      case "MethodInvalidSignature":
        return new ContractMethodInvalidSignatureError(blockHash, blockHeight);
      default:
        error.MethodResolveError;
        return new ContractExecutionError("Unknown method resolve error", blockHash, blockHeight);
    }
  }
  if ("HostError" in error) return parseHostError(error.HostError, blockHash, blockHeight);
  if ("LinkError" in error) return new ContractExecutionError(error.LinkError.msg, blockHash, blockHeight);
  if ("WasmTrap" in error) return new WasmTrapError(error.WasmTrap, blockHash, blockHeight);
  if ("ExecutionError" in error) return new ContractExecutionError(error.ExecutionError, blockHash, blockHeight);
  error;
  return new ContractExecutionError("Unknown contract execution error", blockHash, blockHeight);
}
function parseHostError(error, blockHash, blockHeight) {
  if (typeof error === "string") {
    switch (error) {
      case "BadUTF16":
        return new HostBadUtf16Error(blockHash, blockHeight);
      case "BadUTF8":
        return new HostBadUtf8Error(blockHash, blockHeight);
      case "GasExceeded":
        return new HostGasExceededError(blockHash, blockHeight);
      case "GasLimitExceeded":
        return new HostGasLimitExceededError(blockHash, blockHeight);
      case "BalanceExceeded":
        return new HostBalanceExceededError(blockHash, blockHeight);
      case "EmptyMethodName":
        return new HostEmptyMethodNameError(blockHash, blockHeight);
      case "IntegerOverflow":
        return new HostIntegerOverflowError(blockHash, blockHeight);
      case "CannotAppendActionToJointPromise":
        return new HostCannotAppendActionToJointPromiseError(blockHash, blockHeight);
      case "CannotReturnJointPromise":
        return new HostCannotReturnJointPromiseError(blockHash, blockHeight);
      case "MemoryAccessViolation":
        return new HostMemoryAccessViolationError(blockHash, blockHeight);
      case "InvalidAccountId":
        return new HostInvalidAccountIdError(blockHash, blockHeight);
      case "InvalidMethodName":
        return new HostInvalidMethodNameError(blockHash, blockHeight);
      case "InvalidPublicKey":
        return new HostInvalidPublicKeyError(blockHash, blockHeight);
    }
  }
  if ("GuestPanic" in error) {
    return new HostGuestPanicError(error.GuestPanic.panic_msg, blockHash, blockHeight);
  }
  if ("InvalidPromiseIndex" in error) {
    return new HostInvalidPromiseIndexError(error.InvalidPromiseIndex.promise_idx, blockHash, blockHeight);
  }
  if ("InvalidPromiseResultIndex" in error) {
    return new HostInvalidPromiseResultIndexError(
      error.InvalidPromiseResultIndex.result_idx,
      blockHash,
      blockHeight
    );
  }
  if ("InvalidRegisterId" in error) {
    return new HostInvalidRegisterIdError(error.InvalidRegisterId.register_id, blockHash, blockHeight);
  }
  if ("IteratorWasInvalidated" in error) {
    return new HostIteratorWasInvalidatedError(error.IteratorWasInvalidated.iterator_index, blockHash, blockHeight);
  }
  if ("InvalidReceiptIndex" in error) {
    return new HostInvalidReceiptIndexError(error.InvalidReceiptIndex.receipt_index, blockHash, blockHeight);
  }
  if ("InvalidIteratorIndex" in error) {
    return new HostInvalidIteratorIndexError(error.InvalidIteratorIndex.iterator_index, blockHash, blockHeight);
  }
  if ("ProhibitedInView" in error) {
    return new HostProhibitedInViewError(error.ProhibitedInView.method_name, blockHash, blockHeight);
  }
  if ("NumberOfLogsExceeded" in error) {
    return new HostNumberOfLogsExceededError(error.NumberOfLogsExceeded.limit, blockHash, blockHeight);
  }
  if ("KeyLengthExceeded" in error) {
    return new HostKeyLengthExceededError(
      error.KeyLengthExceeded.length,
      error.KeyLengthExceeded.limit,
      blockHash,
      blockHeight
    );
  }
  if ("ValueLengthExceeded" in error) {
    return new HostValueLengthExceededError(
      error.ValueLengthExceeded.length,
      error.ValueLengthExceeded.limit,
      blockHash,
      blockHeight
    );
  }
  if ("TotalLogLengthExceeded" in error) {
    return new HostTotalLogLengthExceededError(
      error.TotalLogLengthExceeded.length,
      error.TotalLogLengthExceeded.limit,
      blockHash,
      blockHeight
    );
  }
  if ("NumberPromisesExceeded" in error) {
    return new HostNumberPromisesExceededError(
      error.NumberPromisesExceeded.limit,
      error.NumberPromisesExceeded.number_of_promises,
      blockHash,
      blockHeight
    );
  }
  if ("NumberInputDataDependenciesExceeded" in error) {
    return new HostNumberInputDataDependenciesExceededError(
      error.NumberInputDataDependenciesExceeded.limit,
      error.NumberInputDataDependenciesExceeded.number_of_input_data_dependencies,
      blockHash,
      blockHeight
    );
  }
  if ("ReturnedValueLengthExceeded" in error) {
    return new HostReturnedValueLengthExceededError(
      error.ReturnedValueLengthExceeded.length,
      error.ReturnedValueLengthExceeded.limit,
      blockHash,
      blockHeight
    );
  }
  if ("ContractSizeExceeded" in error) {
    return new HostSizeExceededError(
      error.ContractSizeExceeded.size,
      error.ContractSizeExceeded.limit,
      blockHash,
      blockHeight
    );
  }
  if ("Deprecated" in error) {
    return new HostDeprecatedError(error.Deprecated.method_name, blockHash, blockHeight);
  }
  if ("ECRecoverError" in error) {
    return new HostECRecoverError(error.ECRecoverError.msg, blockHash, blockHeight);
  }
  if ("AltBn128InvalidInput" in error) {
    return new HostAltBn128InvalidInputError(error.AltBn128InvalidInput.msg, blockHash, blockHeight);
  }
  if ("Ed25519VerifyInvalidInput" in error) {
    return new HostEd25519VerifyInvalidInputError(error.Ed25519VerifyInvalidInput.msg, blockHash, blockHeight);
  }
  if ("P256VerifyInvalidInput" in error) {
    return new HostP256VerifyInvalidInputError(error.P256VerifyInvalidInput.msg, blockHash, blockHeight);
  }
  error;
  return new ContractExecutionError("Unknown host error", blockHash, blockHeight);
}
function parseRpcErrorMessage(errorMessage, blockHash, blockHeight) {
  switch (true) {
    case /^account (.*?) does not exist while viewing$/.test(errorMessage): {
      const [, accountId] = errorMessage.match(/^account (.*?) does not exist while viewing$/);
      if (typeof accountId !== "string") return new RpcError(errorMessage);
      return new AccountDoesNotExistError(accountId, blockHash, blockHeight);
    }
    case /^Account (.*?) doesn't exist$/.test(errorMessage): {
      const [, accountId] = errorMessage.match(/^Account (.*?) doesn't exist$/);
      if (typeof accountId !== "string") return new RpcError(errorMessage);
      return new AccountDoesNotExistError(accountId, blockHash, blockHeight);
    }
    case /^access key (.*?) does not exist while viewing$/.test(errorMessage): {
      const [, pk] = errorMessage.match(/^access key (.*?) does not exist while viewing$/);
      if (typeof pk !== "string") return new RpcError(errorMessage);
      return new AccessKeyDoesNotExistError(PublicKey.fromString(pk), blockHash, blockHeight);
    }
    case /^wasm execution failed with error: FunctionCallError\(CompilationError\(CodeDoesNotExist { account_id: "(.*?)" }\)\)$/.test(
      errorMessage
    ): {
      const [, accountId] = errorMessage.match(
        /^wasm execution failed with error: FunctionCallError\(CompilationError\(CodeDoesNotExist { account_id: "(.*?)" }\)\)$/
      );
      if (typeof accountId !== "string") return new RpcError(errorMessage);
      return new ContractCodeDoesNotExistError(accountId, blockHash, blockHeight);
    }
    case /^wasm execution failed with error: CompilationError\(CodeDoesNotExist { account_id: "(.*?)" }\)$/.test(
      errorMessage
    ): {
      const [, accountId] = errorMessage.match(
        /^wasm execution failed with error: CompilationError\(CodeDoesNotExist { account_id: "(.*?)" }\)$/
      );
      if (typeof accountId !== "string") return new RpcError(errorMessage);
      return new ContractCodeDoesNotExistError(accountId, blockHash, blockHeight);
    }
    case /^wasm execution failed with error: FunctionCallError\(MethodResolveError\(MethodNotFound\)\)$/.test(
      errorMessage
    ): {
      return new ContractMethodNotFoundError(blockHash, blockHeight);
    }
    case /^wasm execution failed with error: MethodResolveError\(MethodNotFound\)$/.test(errorMessage): {
      return new ContractMethodNotFoundError(blockHash, blockHeight);
    }
    // case /Transaction nonce \d+ must be larger than nonce of the used access key \d+/.test(errorMessage):
    default:
      return new RpcError(errorMessage);
  }
}
function parseTransactionExecutionError(error, txHash, blockHash, transactionResult) {
  let parsedError;
  if ("ActionError" in error) {
    parsedError = parseActionError(error.ActionError, txHash, blockHash);
  } else if ("InvalidTxError" in error) {
    parsedError = parseInvalidTransactionError(error.InvalidTxError, txHash, blockHash);
  } else {
    error;
    parsedError = new TransactionExecutionError("Unknown transaction execution error", txHash, blockHash);
  }
  if (transactionResult && (parsedError instanceof TransactionExecutionError || parsedError instanceof ContractExecutionError)) {
    parsedError.transactionResult = transactionResult;
  }
  return parsedError;
}
function parseActionError(error, txHash, blockHash) {
  const actionIndex = typeof error.index === "number" ? error.index : null;
  if (typeof error.kind === "string") {
    switch (error.kind) {
      case "DelegateActionInvalidSignature":
        return new DelegateActionInvalidSignatureActionError(actionIndex, txHash, blockHash);
      case "DelegateActionExpired":
        return new DelegateActionExpiredActionError(actionIndex, txHash, blockHash);
      default:
        error.kind;
        return new ActionExecutionError("Unknown action error", actionIndex, txHash, blockHash);
    }
  }
  if ("AccountAlreadyExists" in error.kind) {
    return new AccountAlreadyExistsActionError(
      error.kind.AccountAlreadyExists.account_id,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("AccountDoesNotExist" in error.kind) {
    return new AccountDoesNotExistActionError(
      error.kind.AccountDoesNotExist.account_id,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("ActorNoPermission" in error.kind) {
    return new ActorNoPermissionActionError(
      error.kind.ActorNoPermission.account_id,
      error.kind.ActorNoPermission.actor_id,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("AddKeyAlreadyExists" in error.kind) {
    return new AddKeyAlreadyExistsActionError(
      error.kind.AddKeyAlreadyExists.account_id,
      PublicKey.fromString(error.kind.AddKeyAlreadyExists.public_key),
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("DeleteKeyDoesNotExist" in error.kind) {
    return new DeleteKeyDoesNotExistActionError(
      error.kind.DeleteKeyDoesNotExist.account_id,
      PublicKey.from(error.kind.DeleteKeyDoesNotExist.public_key),
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("DeleteAccountStaking" in error.kind) {
    return new DeleteAccountStakingActionError(
      error.kind.DeleteAccountStaking.account_id,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("LackBalanceForState" in error.kind) {
    return new LackBalanceForStateActionError(
      error.kind.LackBalanceForState.account_id,
      BigInt(error.kind.LackBalanceForState.amount),
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("TriesToUnstake" in error.kind) {
    return new TriesToUnstakeActionError(error.kind.TriesToUnstake.account_id, actionIndex, txHash, blockHash);
  }
  if ("TriesToStake" in error.kind) {
    return new TriesToStakeActionError(
      error.kind.TriesToStake.account_id,
      BigInt(error.kind.TriesToStake.balance),
      BigInt(error.kind.TriesToStake.locked),
      BigInt(error.kind.TriesToStake.stake),
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("InsufficientStake" in error.kind) {
    return new InsufficientStakeActionError(
      error.kind.InsufficientStake.account_id,
      BigInt(error.kind.InsufficientStake.minimum_stake),
      BigInt(error.kind.InsufficientStake.stake),
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("OnlyImplicitAccountCreationAllowed" in error.kind) {
    return new OnlyImplicitAccountCreationAllowedActionError(
      error.kind.OnlyImplicitAccountCreationAllowed.account_id,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("DeleteAccountWithLargeState" in error.kind) {
    return new DeleteAccountWithLargeStateActionError(
      error.kind.DeleteAccountWithLargeState.account_id,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("DelegateActionInvalidNonce" in error.kind) {
    return new DelegateActionInvalidNonceActionError(
      error.kind.DelegateActionInvalidNonce.ak_nonce,
      error.kind.DelegateActionInvalidNonce.delegate_nonce,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("DelegateActionNonceTooLarge" in error.kind) {
    return new DelegateActionNonceTooLargeActionError(
      error.kind.DelegateActionNonceTooLarge.delegate_nonce,
      error.kind.DelegateActionNonceTooLarge.upper_bound,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("GasKeyDoesNotExist" in error.kind) {
    return new GasKeyDoesNotExistActionError(
      error.kind.GasKeyDoesNotExist.account_id,
      PublicKey.fromString(error.kind.GasKeyDoesNotExist.public_key),
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("InsufficientGasKeyBalance" in error.kind) {
    return new InsufficientGasKeyBalanceActionError(
      error.kind.InsufficientGasKeyBalance.account_id,
      PublicKey.fromString(error.kind.InsufficientGasKeyBalance.public_key),
      BigInt(error.kind.InsufficientGasKeyBalance.balance),
      BigInt(error.kind.InsufficientGasKeyBalance.required),
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("GasKeyBalanceTooHigh" in error.kind) {
    const publicKey = error.kind.GasKeyBalanceTooHigh.public_key;
    return new GasKeyBalanceTooHighActionError(
      error.kind.GasKeyBalanceTooHigh.account_id,
      BigInt(error.kind.GasKeyBalanceTooHigh.balance),
      publicKey ? PublicKey.fromString(publicKey) : void 0,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("DelegateActionInvalidNonceIndex" in error.kind) {
    return new DelegateActionInvalidNonceIndexActionError(
      error.kind.DelegateActionInvalidNonceIndex.nonce_index,
      error.kind.DelegateActionInvalidNonceIndex.num_nonces,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("GlobalContractDoesNotExist" in error.kind) {
    return new GlobalContractDoesNotExistActionError(
      error.kind.GlobalContractDoesNotExist.identifier,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("FunctionCallError" in error.kind) {
    return parseFunctionCallError(
      error.kind.FunctionCallError,
      blockHash,
      -1
      // blockHeight is unknown here
    );
  }
  if ("NewReceiptValidationError" in error.kind) {
    return parseReceiptValidationError(error.kind.NewReceiptValidationError, actionIndex, txHash, blockHash);
  }
  if ("CreateAccountOnlyByRegistrar" in error.kind) {
    return new CreateAccountOnlyByRegistrarActionError(
      error.kind.CreateAccountOnlyByRegistrar.account_id,
      error.kind.CreateAccountOnlyByRegistrar.predecessor_id,
      error.kind.CreateAccountOnlyByRegistrar.registrar_account_id,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("CreateAccountNotAllowed" in error.kind) {
    return new CreateAccountNotAllowedActionError(
      error.kind.CreateAccountNotAllowed.account_id,
      error.kind.CreateAccountNotAllowed.predecessor_id,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("DelegateActionSenderDoesNotMatchTxReceiver" in error.kind) {
    return new DelegateActionSenderDoesNotMatchTxReceiverActionError(
      error.kind.DelegateActionSenderDoesNotMatchTxReceiver.receiver_id,
      error.kind.DelegateActionSenderDoesNotMatchTxReceiver.sender_id,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("DelegateActionAccessKeyError" in error.kind) {
    return parseInvalidAccessKeyError(error.kind.DelegateActionAccessKeyError, actionIndex, txHash, blockHash);
  }
  error.kind;
  return new ActionExecutionError("Unknown action error", actionIndex, txHash, blockHash);
}
function parseReceiptValidationError(error, actionIndex, txHash, blockHash) {
  if ("InvalidPredecessorId" in error) {
    return new InvalidPredecessorIdReceiptActionError(
      error.InvalidPredecessorId.account_id,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("InvalidReceiverId" in error) {
    return new InvalidReceiverIdReceiptActionError(
      error.InvalidReceiverId.account_id,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("InvalidSignerId" in error) {
    return new InvalidSignerIdReceiptActionError(error.InvalidSignerId.account_id, actionIndex, txHash, blockHash);
  }
  if ("InvalidDataReceiverId" in error) {
    return new InvalidDataReceiverIdReceiptActionError(
      error.InvalidDataReceiverId.account_id,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("ReturnedValueLengthExceeded" in error) {
    return new ReturnedValueLengthExceededReceiptActionError(
      error.ReturnedValueLengthExceeded.length,
      error.ReturnedValueLengthExceeded.limit,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("NumberInputDataDependenciesExceeded" in error) {
    return new NumberInputDataDependenciesExceededReceiptActionError(
      error.NumberInputDataDependenciesExceeded.limit,
      error.NumberInputDataDependenciesExceeded.number_of_input_data_dependencies,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("ActionsValidation" in error) {
    error.ActionsValidation;
    return parseActionsValidationError(error.ActionsValidation, actionIndex, txHash, blockHash);
  }
  if ("ReceiptSizeExceeded" in error) {
    return new ReceiptSizeExceededActionError(
      error.ReceiptSizeExceeded.limit,
      error.ReceiptSizeExceeded.size,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("InvalidRefundTo" in error) {
    return new InvalidRefundToReceiptActionError(error.InvalidRefundTo.account_id, actionIndex, txHash, blockHash);
  }
  error;
  return new ActionExecutionError("Unknown receipt validation error", actionIndex, txHash, blockHash);
}
function parseActionsValidationError(error, actionIndex, txHash, blockHash) {
  if (typeof error === "string") {
    switch (error) {
      case "DeleteActionMustBeFinal":
        return new DeleteActionMustBeFinalActionError(actionIndex, txHash, blockHash);
      case "IntegerOverflow":
        return new IntegerOverflowValidationActionError(actionIndex, txHash, blockHash);
      case "FunctionCallZeroAttachedGas":
        return new FunctionCallZeroAttachedGasActionError(actionIndex, txHash, blockHash);
      case "DelegateActionMustBeOnlyOne":
        return new DelegateActionMustBeOnlyOneActionError(actionIndex, txHash, blockHash);
      case "GasKeyFunctionCallAllowanceNotAllowed":
        return new GasKeyFunctionCallAllowanceNotAllowedActionError(actionIndex, txHash, blockHash);
      default:
        error;
        return new ActionExecutionError("Unknown actions validation error", actionIndex, txHash, blockHash);
    }
  }
  if ("TotalPrepaidGasExceeded" in error) {
    return new TotalPrepaidGasExceededActionError(
      error.TotalPrepaidGasExceeded.limit,
      error.TotalPrepaidGasExceeded.total_prepaid_gas,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("TotalNumberOfActionsExceeded" in error) {
    return new TotalNumberOfActionsExceededActionError(
      error.TotalNumberOfActionsExceeded.limit,
      error.TotalNumberOfActionsExceeded.total_number_of_actions,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("AddKeyMethodNamesNumberOfBytesExceeded" in error) {
    return new AddKeyMethodNamesNumberOfBytesExceededActionError(
      error.AddKeyMethodNamesNumberOfBytesExceeded.limit,
      error.AddKeyMethodNamesNumberOfBytesExceeded.total_number_of_bytes,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("AddKeyMethodNameLengthExceeded" in error) {
    return new AddKeyMethodNameLengthExceededActionError(
      error.AddKeyMethodNameLengthExceeded.length,
      error.AddKeyMethodNameLengthExceeded.limit,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("InvalidAccountId" in error) {
    return new InvalidAccountIdValidationActionError(
      error.InvalidAccountId.account_id,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("ContractSizeExceeded" in error) {
    return new ContractSizeExceededValidationActionError(
      error.ContractSizeExceeded.limit,
      error.ContractSizeExceeded.size,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("FunctionCallMethodNameLengthExceeded" in error) {
    return new FunctionCallMethodNameLengthExceededActionError(
      error.FunctionCallMethodNameLengthExceeded.length,
      error.FunctionCallMethodNameLengthExceeded.limit,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("FunctionCallArgumentsLengthExceeded" in error) {
    return new FunctionCallArgumentsLengthExceededActionError(
      error.FunctionCallArgumentsLengthExceeded.length,
      error.FunctionCallArgumentsLengthExceeded.limit,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("UnsuitableStakingKey" in error) {
    return new UnsuitableStakingKeyActionError(
      PublicKey.fromString(error.UnsuitableStakingKey.public_key),
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("UnsupportedProtocolFeature" in error) {
    return new UnsupportedProtocolFeatureActionError(
      error.UnsupportedProtocolFeature.protocol_feature,
      error.UnsupportedProtocolFeature.version,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("InvalidDeterministicStateInitReceiver" in error) {
    return new InvalidDeterministicStateInitReceiverActionError(
      error.InvalidDeterministicStateInitReceiver.derived_id,
      error.InvalidDeterministicStateInitReceiver.receiver_id,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("DeterministicStateInitKeyLengthExceeded" in error) {
    return new DeterministicStateInitKeyLengthExceededActionError(
      error.DeterministicStateInitKeyLengthExceeded.length,
      error.DeterministicStateInitKeyLengthExceeded.limit,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("DeterministicStateInitValueLengthExceeded" in error) {
    return new DeterministicStateInitValueLengthExceededActionError(
      error.DeterministicStateInitValueLengthExceeded.length,
      error.DeterministicStateInitValueLengthExceeded.limit,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("GasKeyInvalidNumNonces" in error) {
    return new GasKeyInvalidNumNoncesActionError(
      error.GasKeyInvalidNumNonces.limit,
      error.GasKeyInvalidNumNonces.requested_nonces,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("AddGasKeyWithNonZeroBalance" in error) {
    return new AddGasKeyWithNonZeroBalanceActionError(
      BigInt(error.AddGasKeyWithNonZeroBalance.balance),
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("TotalNumberOfDeployActionsExceeded" in error) {
    return new TotalNumberOfDeployActionsExceededActionError(
      error.TotalNumberOfDeployActionsExceeded.limit,
      error.TotalNumberOfDeployActionsExceeded.number_of_deploy_actions,
      actionIndex,
      txHash,
      blockHash
    );
  }
  error;
  return new ActionExecutionError("Unknown actions validation error", actionIndex, txHash, blockHash);
}
function parseInvalidAccessKeyError(error, actionIndex, txHash, blockHash) {
  if (typeof error === "string") {
    switch (error) {
      case "RequiresFullAccess":
        return new AccessKeyRequiresFullAccessActionError(actionIndex, txHash, blockHash);
      case "DepositWithFunctionCall":
        return new AccessKeyDepositWithFunctionCallActionError(actionIndex, txHash, blockHash);
      case "DelegateActionRequiresGasKey":
        return new DelegateActionRequiresGasKeyActionError(actionIndex, txHash, blockHash);
      case "DelegateActionRequiresNonGasKey":
        return new DelegateActionRequiresNonGasKeyActionError(actionIndex, txHash, blockHash);
      default:
        error;
        return new ActionExecutionError("Unknown invalid access key error", actionIndex, txHash, blockHash);
    }
  }
  if ("AccessKeyNotFound" in error) {
    return new AccessKeyNotFoundActionError(
      error.AccessKeyNotFound.account_id,
      PublicKey.fromString(error.AccessKeyNotFound.public_key),
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("ReceiverMismatch" in error) {
    return new AccessKeyReceiverMismatchActionError(
      error.ReceiverMismatch.ak_receiver,
      error.ReceiverMismatch.tx_receiver,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("MethodNameMismatch" in error) {
    return new AccessKeyMethodNameMismatchActionError(
      error.MethodNameMismatch.method_name,
      actionIndex,
      txHash,
      blockHash
    );
  }
  if ("NotEnoughAllowance" in error) {
    return new AccessKeyNotEnoughAllowanceActionError(
      error.NotEnoughAllowance.account_id,
      BigInt(error.NotEnoughAllowance.allowance),
      BigInt(error.NotEnoughAllowance.cost),
      PublicKey.fromString(error.NotEnoughAllowance.public_key),
      actionIndex,
      txHash,
      blockHash
    );
  }
  error;
  return new ActionExecutionError("Unknown invalid access key error", actionIndex, txHash, blockHash);
}
function parseInvalidTransactionError(error, txHash, blockHash) {
  if (typeof error === "string") {
    switch (error) {
      case "InvalidSignature":
        return new InvalidSignatureError(txHash, blockHash);
      case "CostOverflow":
        return new CostOverflowError(txHash, blockHash);
      case "InvalidChain":
        return new InvalidChainError(txHash, blockHash);
      case "Expired":
        return new TransactionExpiredError(txHash, blockHash);
      case "InvalidTransactionVersion":
        return new InvalidTransactionVersionError(txHash, blockHash);
      default:
        error;
        return new TransactionExecutionError("Unknown invalid transaction error", txHash, blockHash);
    }
  }
  if ("InvalidAccessKeyError" in error) {
    return parseInvalidAccessKeyError(error.InvalidAccessKeyError, null, txHash, blockHash);
  }
  if ("InvalidSignerId" in error) {
    return new InvalidSignerIdError(error.InvalidSignerId.signer_id, txHash, blockHash);
  }
  if ("SignerDoesNotExist" in error) {
    return new SignerDoesNotExistError(error.SignerDoesNotExist.signer_id, txHash, blockHash);
  }
  if ("InvalidNonce" in error) {
    return new InvalidNonceError(error.InvalidNonce.ak_nonce, error.InvalidNonce.tx_nonce, txHash, blockHash);
  }
  if ("NonceTooLarge" in error) {
    return new NonceTooLargeError(error.NonceTooLarge.tx_nonce, error.NonceTooLarge.upper_bound, txHash, blockHash);
  }
  if ("InvalidReceiverId" in error) {
    return new InvalidReceiverIdError(error.InvalidReceiverId.receiver_id, txHash, blockHash);
  }
  if ("NotEnoughBalance" in error) {
    return new NotEnoughBalanceError(
      BigInt(error.NotEnoughBalance.balance),
      BigInt(error.NotEnoughBalance.cost),
      error.NotEnoughBalance.signer_id,
      txHash,
      blockHash
    );
  }
  if ("LackBalanceForState" in error) {
    return new LackBalanceForStateActionError(
      error.LackBalanceForState.signer_id,
      BigInt(error.LackBalanceForState.amount),
      null,
      txHash,
      blockHash
    );
  }
  if ("TransactionSizeExceeded" in error) {
    return new TransactionSizeExceededError(
      error.TransactionSizeExceeded.limit,
      error.TransactionSizeExceeded.size,
      txHash,
      blockHash
    );
  }
  if ("StorageError" in error) {
    const storage = error.StorageError;
    if (storage === "StorageInternalError") {
      return new StorageInternalError(txHash, blockHash);
    }
    if (storage === "UnexpectedTrieValue") {
      return new UnexpectedTrieValueError(txHash, blockHash);
    }
    if ("MissingTrieValue" in storage) {
      return new MissingTrieValueError(
        storage.MissingTrieValue.context,
        storage.MissingTrieValue.hash,
        txHash,
        blockHash
      );
    }
    if ("StorageInconsistentState" in storage) {
      return new StorageInconsistentStateError(storage.StorageInconsistentState, txHash, blockHash);
    }
    if ("FlatStorageBlockNotSupported" in storage) {
      return new FlatStorageBlockNotSupportedError(storage.FlatStorageBlockNotSupported, txHash, blockHash);
    }
    if ("MemTrieLoadingError" in storage) {
      return new MemTrieLoadingError(storage.MemTrieLoadingError, txHash, blockHash);
    }
    storage;
    return new TransactionExecutionError("Unknown storage error", txHash, blockHash);
  }
  if ("ShardCongested" in error) {
    return new ShardCongestedError(
      error.ShardCongested.congestion_level,
      error.ShardCongested.shard_id,
      txHash,
      blockHash
    );
  }
  if ("ShardStuck" in error) {
    return new ShardStuckError(error.ShardStuck.missed_chunks, error.ShardStuck.shard_id, txHash, blockHash);
  }
  if ("ActionsValidation" in error) {
    return parseActionsValidationError(error.ActionsValidation, null, txHash, blockHash);
  }
  if ("InvalidNonceIndex" in error) {
    return new InvalidNonceIndexError(
      error.InvalidNonceIndex.num_nonces,
      error.InvalidNonceIndex.tx_nonce_index ?? void 0,
      txHash,
      blockHash
    );
  }
  if ("NotEnoughGasKeyBalance" in error) {
    return new NotEnoughGasKeyBalanceError(
      BigInt(error.NotEnoughGasKeyBalance.balance),
      BigInt(error.NotEnoughGasKeyBalance.cost),
      error.NotEnoughGasKeyBalance.signer_id,
      txHash,
      blockHash
    );
  }
  if ("NotEnoughBalanceForDeposit" in error) {
    return new NotEnoughBalanceForDepositError(
      BigInt(error.NotEnoughBalanceForDeposit.balance),
      BigInt(error.NotEnoughBalanceForDeposit.cost),
      error.NotEnoughBalanceForDeposit.signer_id,
      error.NotEnoughBalanceForDeposit.reason,
      txHash,
      blockHash
    );
  }
  error;
  return new TransactionExecutionError("Unknown invalid transaction error", txHash, blockHash);
}
var Enum2 = class {
  constructor(properties) {
    if (Object.keys(properties).length !== 1) {
      throw new Error("Enum can only take single value");
    }
    Object.keys(properties).forEach((key) => {
      this[key] = properties[key];
    });
  }
};
var TypedError = class extends Error {
  constructor(message, type, context) {
    super(message);
    this.type = type || "UntypedError";
    this.context = context;
  }
};
var FunctionCallPermission = class {
  constructor({
    allowance,
    receiverId,
    methodNames
  }) {
    this.allowance = allowance;
    this.receiverId = receiverId;
    this.methodNames = methodNames;
  }
};
var FullAccessPermission = class {
};
var GasKeyInfo = class {
  constructor({ balance, numNonces }) {
    this.balance = balance;
    this.numNonces = numNonces;
  }
};
var GasKeyFunctionCallPermission = class {
  constructor({ gasKeyInfo, functionCall: functionCall42 }) {
    this.gasKeyInfo = gasKeyInfo;
    this.functionCall = functionCall42;
  }
};
var AccessKeyPermission = class extends Enum2 {
  constructor(props) {
    super(props);
    for (const [k, v] of Object.entries(props || {})) {
      this[k] = v;
      this.enum = k;
    }
  }
};
var AccessKey = class {
  constructor({ nonce, permission }) {
    this.nonce = nonce;
    this.permission = permission;
  }
};
var CreateAccount = class {
};
var DeployContract = class {
  constructor({ code }) {
    this.code = code;
  }
};
var FunctionCall = class {
  constructor({
    methodName,
    args,
    gas,
    deposit
  }) {
    this.methodName = methodName;
    this.args = args;
    this.gas = gas;
    this.deposit = deposit;
  }
};
var GlobalContractDeployMode = class extends Enum2 {
  constructor(props) {
    super(props);
    for (const [k, v] of Object.entries(props || {})) {
      this[k] = v;
      this.enum = k;
    }
  }
};
var GlobalContractIdentifier = class extends Enum2 {
  constructor(props) {
    super(props);
    for (const [k, v] of Object.entries(props || {})) {
      this[k] = v;
      this.enum = k;
    }
  }
};
var DeployGlobalContract = class {
  constructor({ code, deployMode }) {
    this.code = code;
    this.deployMode = deployMode;
  }
};
var UseGlobalContract = class {
  constructor({ contractIdentifier }) {
    this.contractIdentifier = contractIdentifier;
  }
};
var Transfer = class {
  constructor({ deposit }) {
    this.deposit = deposit;
  }
};
var Stake = class {
  constructor({ stake: stake32, publicKey }) {
    this.stake = stake32;
    this.publicKey = publicKey;
  }
};
var AddKey = class {
  constructor({ publicKey, accessKey }) {
    this.publicKey = publicKey;
    this.accessKey = accessKey;
  }
};
var DeleteKey = class {
  constructor({ publicKey }) {
    this.publicKey = publicKey;
  }
};
var DeleteAccount = class {
  constructor({ beneficiaryId }) {
    this.beneficiaryId = beneficiaryId;
  }
};
var TransferToGasKey = class {
  constructor({ publicKey, deposit }) {
    this.publicKey = publicKey;
    this.deposit = deposit;
  }
};
var WithdrawFromGasKey = class {
  constructor({ publicKey, amount }) {
    this.publicKey = publicKey;
    this.amount = amount;
  }
};
var SignedDelegate = class {
  constructor({ delegateAction, signature }) {
    this.delegateAction = delegateAction;
    this.signature = signature;
  }
};
var Action = class extends Enum2 {
  constructor(props) {
    super(props);
    for (const [k, v] of Object.entries(props || {})) {
      this[k] = v;
      this.enum = k;
    }
  }
};
function fullAccessKey() {
  return new AccessKey({
    nonce: 0n,
    permission: new AccessKeyPermission({
      fullAccess: new FullAccessPermission()
    })
  });
}
function functionCallAccessKey(receiverId, methodNames, allowance) {
  return new AccessKey({
    nonce: 0n,
    permission: new AccessKeyPermission({
      functionCall: new FunctionCallPermission({
        receiverId,
        allowance,
        methodNames
      })
    })
  });
}
function fullAccessGasKey(numNonces) {
  return new AccessKey({
    nonce: 0n,
    permission: new AccessKeyPermission({
      gasKeyFullAccess: new GasKeyInfo({ balance: 0n, numNonces })
    })
  });
}
function functionCallGasKey(receiverId, methodNames, numNonces) {
  return new AccessKey({
    nonce: 0n,
    permission: new AccessKeyPermission({
      gasKeyFunctionCall: new GasKeyFunctionCallPermission({
        gasKeyInfo: new GasKeyInfo({ balance: 0n, numNonces }),
        functionCall: new FunctionCallPermission({ receiverId, methodNames })
      })
    })
  });
}
function createAccount() {
  return new Action({ createAccount: new CreateAccount() });
}
function deployContract(code) {
  return new Action({ deployContract: new DeployContract({ code }) });
}
function stringifyJsonOrBytes(args) {
  if (args instanceof Uint8Array) return args;
  return stringToBytes(JSON.stringify(args));
}
function functionCall(methodName, args, gas = 0n, deposit = 0n, stringify = stringifyJsonOrBytes) {
  return new Action({
    functionCall: new FunctionCall({
      methodName,
      args: stringify(args),
      gas,
      deposit
    })
  });
}
function transfer(deposit = 0n) {
  return new Action({ transfer: new Transfer({ deposit }) });
}
function stake(stake32 = 0n, publicKey) {
  return new Action({ stake: new Stake({ stake: stake32, publicKey }) });
}
function addKey(publicKey, accessKey) {
  return new Action({ addKey: new AddKey({ publicKey, accessKey }) });
}
function addFullAccessKey(publicKey) {
  return addKey(publicKey, fullAccessKey());
}
function addFunctionCallAccessKey(publicKey, receiverId, methodNames, allowance) {
  return addKey(publicKey, functionCallAccessKey(receiverId, methodNames, allowance));
}
function addFullAccessGasKey(publicKey, numNonces) {
  return addKey(publicKey, fullAccessGasKey(numNonces));
}
function addFunctionCallGasKey(publicKey, receiverId, methodNames, numNonces) {
  return addKey(publicKey, functionCallGasKey(receiverId, methodNames, numNonces));
}
function transferToGasKey(publicKey, deposit) {
  return new Action({ transferToGasKey: new TransferToGasKey({ publicKey, deposit }) });
}
function withdrawFromGasKey(publicKey, amount) {
  return new Action({ withdrawFromGasKey: new WithdrawFromGasKey({ publicKey, amount }) });
}
function deleteKey(publicKey) {
  return new Action({ deleteKey: new DeleteKey({ publicKey }) });
}
function deleteAccount(beneficiaryId) {
  return new Action({ deleteAccount: new DeleteAccount({ beneficiaryId }) });
}
function signedDelegate({
  delegateAction,
  signature
}) {
  return new Action({
    signedDelegate: new SignedDelegate({ delegateAction, signature })
  });
}
function deployGlobalContract(code, deployMode) {
  const mode = deployMode === "codeHash" ? new GlobalContractDeployMode({ CodeHash: null }) : new GlobalContractDeployMode({ AccountId: null });
  return new Action({ deployGlobalContract: new DeployGlobalContract({ code, deployMode: mode }) });
}
function useGlobalContract(contractIdentifier) {
  const identifier = "accountId" in contractIdentifier ? new GlobalContractIdentifier({
    AccountId: contractIdentifier.accountId
  }) : new GlobalContractIdentifier({
    CodeHash: typeof contractIdentifier.codeHash === "string" ? new Uint8Array(
      contractIdentifier.codeHash.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
    ) : contractIdentifier.codeHash
  });
  return new Action({ useGlobalContract: new UseGlobalContract({ contractIdentifier: identifier }) });
}
var actions = {
  addFullAccessGasKey,
  addFullAccessKey,
  addFunctionCallAccessKey,
  addFunctionCallGasKey,
  createAccount,
  deleteAccount,
  deleteKey,
  deployContract,
  fullAccessGasKey,
  fullAccessKey,
  functionCall,
  functionCallAccessKey,
  functionCallGasKey,
  signedDelegate,
  stake,
  transfer,
  deployGlobalContract,
  useGlobalContract,
  transferToGasKey,
  withdrawFromGasKey
};
var ACTIONABLE_MESSAGE_BASE = 2 ** 30;
var NEP = {
  MetaTransactions: 366
};
var NEPPrefix = class {
  constructor({ prefix }) {
    this.prefix = prefix;
  }
};
var ActionableMessagePrefix = class extends NEPPrefix {
  /** Given the NEP number, set the prefix using 2^30 as the offset **/
  constructor(prefix) {
    super({ prefix: ACTIONABLE_MESSAGE_BASE + prefix });
  }
};
var DelegateActionPrefix = class extends ActionableMessagePrefix {
  constructor() {
    super(NEP.MetaTransactions);
  }
};
function encodeDelegateAction(delegateAction) {
  return new Uint8Array([
    ...serialize(SCHEMA.DelegateActionPrefix, new DelegateActionPrefix()),
    ...serialize(SCHEMA.DelegateAction, delegateAction)
  ]);
}
function encodeTransaction(transaction) {
  if ("signature" in transaction) {
    if (!isTransactionV1(transaction.transaction)) return serialize(SCHEMA.SignedTransaction, transaction);
    return serialize(SCHEMA.SignedTransactionV1, {
      transaction: toTransactionV1(transaction.transaction),
      signature: transaction.signature
    });
  }
  if (!isTransactionV1(transaction)) return serialize(SCHEMA.Transaction, transaction);
  return serialize(SCHEMA.TransactionV1, toTransactionV1(transaction));
}
function decodeTransaction(bytes) {
  if (bytes[0] !== TRANSACTION_V1_PREFIX) {
    return new Transaction(deserialize(SCHEMA.Transaction, bytes));
  }
  return fromTransactionV1(deserialize(SCHEMA.TransactionV1, bytes));
}
function decodeSignedTransaction(bytes) {
  if (bytes[0] !== TRANSACTION_V1_PREFIX) {
    return new SignedTransaction(deserialize(SCHEMA.SignedTransaction, bytes));
  }
  const { transaction, signature } = deserialize(SCHEMA.SignedTransactionV1, bytes);
  return new SignedTransaction({ transaction: fromTransactionV1(transaction), signature });
}
var TRANSACTION_V1_PREFIX = 1;
function isTransactionV1(transaction) {
  return transaction.nonceIndex !== void 0 || transaction.nonceMode !== void 0;
}
function toTransactionV1({
  signerId,
  publicKey,
  nonce,
  nonceIndex,
  nonceMode = "monotonic",
  receiverId,
  blockHash,
  actions: actions22
}) {
  return {
    version: TRANSACTION_V1_PREFIX,
    signerId,
    publicKey,
    nonce: nonceIndex === void 0 ? { nonce: { nonce } } : { gasKeyNonce: { nonce, nonceIndex } },
    receiverId,
    blockHash,
    actions: actions22,
    nonceMode: nonceMode === "strict" ? { strict: {} } : { monotonic: {} }
  };
}
function fromTransactionV1({ nonce, nonceMode, version: _version, ...rest }) {
  return new Transaction({
    ...rest,
    ..."gasKeyNonce" in nonce ? nonce.gasKeyNonce : nonce.nonce,
    nonceMode: "strict" in nonceMode ? "strict" : "monotonic"
  });
}
var Transaction = class {
  constructor({
    signerId,
    publicKey,
    nonce,
    receiverId,
    actions: actions22,
    blockHash,
    nonceIndex,
    nonceMode
  }) {
    this.signerId = signerId;
    this.publicKey = PublicKey.from(publicKey);
    this.nonce = nonce;
    this.receiverId = receiverId;
    this.actions = actions22;
    this.blockHash = blockHash;
    if (nonceIndex !== void 0) this.nonceIndex = nonceIndex;
    if (nonceMode !== void 0) this.nonceMode = nonceMode;
  }
  encode() {
    return encodeTransaction(this);
  }
  static decode(bytes) {
    return decodeTransaction(bytes);
  }
};
var SignedTransaction = class {
  constructor({ transaction, signature }) {
    this.transaction = transaction instanceof Transaction ? transaction : new Transaction(transaction);
    this.signature = signature;
  }
  encode() {
    return encodeTransaction(this);
  }
  static decode(bytes) {
    return decodeSignedTransaction(bytes);
  }
};
var SCHEMA = new class BorshSchema {
  constructor() {
    this.Ed25519Signature = {
      struct: {
        data: { array: { type: "u8", len: 64 } }
      }
    };
    this.Secp256k1Signature = {
      struct: {
        data: { array: { type: "u8", len: 65 } }
      }
    };
    this.MlDsa65Signature = {
      struct: {
        data: { array: { type: "u8", len: 3309 } }
      }
    };
    this.Signature = {
      enum: [
        { struct: { ed25519Signature: this.Ed25519Signature } },
        { struct: { secp256k1Signature: this.Secp256k1Signature } },
        { struct: { mlDsa65Signature: this.MlDsa65Signature } }
      ]
    };
    this.Ed25519Data = {
      struct: {
        data: { array: { type: "u8", len: 32 } }
      }
    };
    this.Secp256k1Data = {
      struct: {
        data: { array: { type: "u8", len: 64 } }
      }
    };
    this.MlDsa65Data = {
      struct: {
        data: { array: { type: "u8", len: 1952 } }
      }
    };
    this.PublicKey = {
      enum: [
        { struct: { ed25519Key: this.Ed25519Data } },
        { struct: { secp256k1Key: this.Secp256k1Data } },
        { struct: { mlDsa65Key: this.MlDsa65Data } }
      ]
    };
    this.FunctionCallPermission = {
      struct: {
        allowance: { option: "u128" },
        receiverId: "string",
        methodNames: { array: { type: "string" } }
      }
    };
    this.FullAccessPermission = {
      struct: {}
    };
    this.GasKeyInfo = {
      struct: {
        balance: "u128",
        numNonces: "u16"
      }
    };
    this.GasKeyFunctionCallPermission = {
      struct: {
        gasKeyInfo: this.GasKeyInfo,
        functionCall: this.FunctionCallPermission
      }
    };
    this.AccessKeyPermission = {
      enum: [
        { struct: { functionCall: this.FunctionCallPermission } },
        { struct: { fullAccess: this.FullAccessPermission } },
        { struct: { gasKeyFunctionCall: this.GasKeyFunctionCallPermission } },
        { struct: { gasKeyFullAccess: this.GasKeyInfo } }
      ]
    };
    this.AccessKey = {
      struct: {
        nonce: "u64",
        permission: this.AccessKeyPermission
      }
    };
    this.CreateAccount = {
      struct: {}
    };
    this.DeployContract = {
      struct: {
        code: { array: { type: "u8" } }
      }
    };
    this.FunctionCall = {
      struct: {
        methodName: "string",
        args: { array: { type: "u8" } },
        gas: "u64",
        deposit: "u128"
      }
    };
    this.Transfer = {
      struct: {
        deposit: "u128"
      }
    };
    this.Stake = {
      struct: {
        stake: "u128",
        publicKey: this.PublicKey
      }
    };
    this.AddKey = {
      struct: {
        publicKey: this.PublicKey,
        accessKey: this.AccessKey
      }
    };
    this.DeleteKey = {
      struct: {
        publicKey: this.PublicKey
      }
    };
    this.DeleteAccount = {
      struct: {
        beneficiaryId: "string"
      }
    };
    this.GlobalContractDeployMode = {
      enum: [{ struct: { CodeHash: { struct: {} } } }, { struct: { AccountId: { struct: {} } } }]
    };
    this.GlobalContractIdentifier = {
      enum: [{ struct: { CodeHash: { array: { type: "u8", len: 32 } } } }, { struct: { AccountId: "string" } }]
    };
    this.DeployGlobalContract = {
      struct: {
        code: { array: { type: "u8" } },
        deployMode: this.GlobalContractDeployMode
      }
    };
    this.UseGlobalContract = {
      struct: {
        contractIdentifier: this.GlobalContractIdentifier
      }
    };
    this.TransferToGasKey = {
      struct: {
        publicKey: this.PublicKey,
        deposit: "u128"
      }
    };
    this.WithdrawFromGasKey = {
      struct: {
        publicKey: this.PublicKey,
        amount: "u128"
      }
    };
    this.DelegateActionPrefix = {
      struct: {
        prefix: "u32"
      }
    };
    this.ClassicActions = {
      enum: [
        { struct: { createAccount: this.CreateAccount } },
        { struct: { deployContract: this.DeployContract } },
        { struct: { functionCall: this.FunctionCall } },
        { struct: { transfer: this.Transfer } },
        { struct: { stake: this.Stake } },
        { struct: { addKey: this.AddKey } },
        { struct: { deleteKey: this.DeleteKey } },
        { struct: { deleteAccount: this.DeleteAccount } },
        { struct: { signedDelegate: "string" } },
        // placeholder to keep the right enum order, should not be used
        { struct: { deployGlobalContract: this.DeployGlobalContract } },
        { struct: { useGlobalContract: this.UseGlobalContract } },
        { struct: { deterministicStateInit: "string" } },
        // placeholder to keep the right enum order, should not be used
        { struct: { transferToGasKey: this.TransferToGasKey } },
        { struct: { withdrawFromGasKey: this.WithdrawFromGasKey } }
      ]
    };
    this.DelegateAction = {
      struct: {
        senderId: "string",
        receiverId: "string",
        actions: { array: { type: this.ClassicActions } },
        nonce: "u64",
        maxBlockHeight: "u64",
        publicKey: this.PublicKey
      }
    };
    this.SignedDelegate = {
      struct: {
        delegateAction: this.DelegateAction,
        signature: this.Signature
      }
    };
    this.Action = {
      enum: [
        { struct: { createAccount: this.CreateAccount } },
        { struct: { deployContract: this.DeployContract } },
        { struct: { functionCall: this.FunctionCall } },
        { struct: { transfer: this.Transfer } },
        { struct: { stake: this.Stake } },
        { struct: { addKey: this.AddKey } },
        { struct: { deleteKey: this.DeleteKey } },
        { struct: { deleteAccount: this.DeleteAccount } },
        { struct: { signedDelegate: this.SignedDelegate } },
        { struct: { deployGlobalContract: this.DeployGlobalContract } },
        { struct: { useGlobalContract: this.UseGlobalContract } },
        { struct: { deterministicStateInit: "string" } },
        // placeholder to keep the right enum order, should not be used
        { struct: { transferToGasKey: this.TransferToGasKey } },
        { struct: { withdrawFromGasKey: this.WithdrawFromGasKey } }
      ]
    };
    this.Transaction = {
      struct: {
        signerId: "string",
        publicKey: this.PublicKey,
        nonce: "u64",
        receiverId: "string",
        blockHash: { array: { type: "u8", len: 32 } },
        actions: { array: { type: this.Action } }
      }
    };
    this.SignedTransaction = {
      struct: {
        transaction: this.Transaction,
        signature: this.Signature
      }
    };
    this.TransactionNonce = {
      enum: [
        { struct: { nonce: { struct: { nonce: "u64" } } } },
        { struct: { gasKeyNonce: { struct: { nonce: "u64", nonceIndex: "u16" } } } }
      ]
    };
    this.NonceMode = {
      enum: [{ struct: { monotonic: { struct: {} } } }, { struct: { strict: { struct: {} } } }]
    };
    this.TransactionV1 = {
      struct: {
        version: "u8",
        signerId: "string",
        publicKey: this.PublicKey,
        nonce: this.TransactionNonce,
        receiverId: "string",
        blockHash: { array: { type: "u8", len: 32 } },
        actions: { array: { type: this.Action } },
        nonceMode: this.NonceMode
      }
    };
    this.SignedTransactionV1 = {
      struct: {
        transaction: this.TransactionV1,
        signature: this.Signature
      }
    };
  }
}();
function createTransaction(signerId, publicKey, receiverId, nonce, actions22, blockHash, nonceIndex, nonceMode) {
  const txNonce = typeof nonce === "bigint" ? nonce : BigInt(nonce);
  return new Transaction({
    signerId,
    publicKey,
    nonce: txNonce,
    receiverId,
    actions: actions22,
    blockHash,
    nonceIndex,
    nonceMode
  });
}
var {
  createAccount: createAccount2,
  deleteAccount: deleteAccount2,
  deleteKey: deleteKey2,
  deployContract: deployContract2,
  functionCall: functionCall2,
  stake: stake2,
  transfer: transfer2,
  deployGlobalContract: deployGlobalContract2,
  useGlobalContract: useGlobalContract2
} = actions;
var DelegateAction = class {
  constructor({
    senderId,
    receiverId,
    actions: actions22,
    nonce,
    maxBlockHeight,
    publicKey
  }) {
    this.senderId = senderId;
    this.receiverId = receiverId;
    this.actions = actions22;
    this.nonce = nonce;
    this.maxBlockHeight = maxBlockHeight;
    this.publicKey = publicKey;
  }
};
function buildDelegateAction({
  actions: actions22,
  maxBlockHeight,
  nonce,
  publicKey,
  receiverId,
  senderId
}) {
  return new DelegateAction({
    senderId,
    receiverId,
    actions: actions22.map((a) => {
      if (!a.type && !a.params) {
        return a;
      }
      switch (a.type) {
        case "AddKey": {
          const { publicKey: publicKey2, accessKey } = a.params;
          return new Action({ addKey: new AddKey({ publicKey: publicKey2, accessKey }) });
        }
        case "CreateAccount": {
          return createAccount2(a.params.createAccount);
        }
        case "DeleteAccount": {
          return deleteAccount2(a.params.deleteAccount);
        }
        case "DeleteKey": {
          return deleteKey2(a.params.publicKey);
        }
        case "DeployContract": {
          return deployContract2(a.params.code);
        }
        case "FunctionCall": {
          const { methodName, args, gas, deposit } = a.params;
          return functionCall2(methodName, args, gas, deposit);
        }
        case "Stake": {
          return stake2(a.params.stake, a.params.publicKey);
        }
        case "Transfer": {
          const { deposit } = a.params;
          return transfer2(deposit);
        }
        case "DeployGlobalContract": {
          const { code, deployMode } = a.params;
          const modeInstance = "CodeHash" in deployMode ? "codeHash" : "accountId";
          return deployGlobalContract2(code, modeInstance);
        }
        case "UseGlobalContract": {
          const { identifier } = a.params;
          const idInstance = "CodeHash" in identifier ? { codeHash: identifier.CodeHash } : { accountId: identifier.AccountId };
          return useGlobalContract2(idInstance);
        }
      }
      throw new Error("Unrecognized action");
    }),
    nonce,
    maxBlockHeight,
    publicKey
  });
}
function resolveEnumKeyName2(keyType) {
  switch (keyType) {
    case 0: {
      return "ed25519Signature";
    }
    case 1: {
      return "secp256k1Signature";
    }
    case 2: {
      return "mlDsa65Signature";
    }
    default: {
      throw Error(`unknown type ${keyType}`);
    }
  }
}
var Signature = class extends Enum2 {
  constructor(signature) {
    const keyName = resolveEnumKeyName2(signature.keyType);
    super({ [keyName]: signature });
    this[keyName] = signature;
    this.enum = keyName;
  }
  get signature() {
    return this.ed25519Signature || this.secp256k1Signature || this.mlDsa65Signature;
  }
  get signatureType() {
    if (typeof this.signature === "undefined") throw new Error(`Property 'signature' of Signature is undefined`);
    return this.signature.keyType;
  }
  get data() {
    if (typeof this.signature === "undefined") throw new Error(`Property 'signature' of Signature is undefined`);
    return this.signature.data;
  }
};
var BACKOFF_MULTIPLIER = 1.5;
var RETRY_NUMBER = 10;
var RETRY_DELAY = 0;
async function backOff(fn, options) {
  const { numOfAttempts, timeMultiple, startingDelay, retry } = options;
  let delay = startingDelay;
  for (let attempt = 1; attempt <= numOfAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === numOfAttempts || !retry(error)) {
        throw error;
      }
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      delay = delay === 0 ? 1 : delay * timeMultiple;
    }
  }
  return void 0;
}
function retryConfig(numOfAttempts = RETRY_NUMBER, timeMultiple = BACKOFF_MULTIPLIER, startingDelay = RETRY_DELAY) {
  return {
    numOfAttempts,
    timeMultiple,
    startingDelay,
    retry: (e) => {
      if ([503, 500, 408].includes(e.cause)) {
        return true;
      }
      if (e.toString().includes("FetchError") || e.toString().includes("Failed to fetch")) {
        return true;
      }
      return false;
    }
  };
}
var ProviderError = class extends Error {
  constructor(message, options) {
    super(message, options);
    this.cause = -1;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
};
async function fetchJsonRpc(url, json, headers, retryConfig2) {
  const response = await backOff(async () => {
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(json),
      headers: { ...headers, "Content-Type": "application/json" }
    });
    const { status } = res;
    if (status === 500) {
      throw new ProviderError("Internal server error", { cause: status });
    } else if (status === 408) {
      throw new ProviderError("Timeout error", { cause: status });
    } else if (status === 429) {
      throw new ProviderError(await res.text(), { cause: status });
    } else if (status === 502) {
      throw new ProviderError(`${url} Bad Gateway`, { cause: status });
    } else if (status === 503) {
      throw new ProviderError(`${url} unavailable`, { cause: status });
    }
    return res;
  }, retryConfig2);
  if (!response) {
    throw new TypedError(`Exceeded ${RETRY_NUMBER} attempts for ${url}.`, "RetriesExceeded");
  }
  return await response.json();
}
var REQUEST_RETRY_NUMBER = 12;
var REQUEST_RETRY_WAIT = 500;
var REQUEST_RETRY_WAIT_BACKOFF = 1.5;
var _nextId = 123;
var DEFAULT_FINALITY = "optimistic";
var JsonRpcProvider = class {
  /**
   * @param connectionInfo Connection info
   */
  constructor(connectionInfo, options) {
    this.connection = connectionInfo || { url: "" };
    const defaultOptions = {
      retries: REQUEST_RETRY_NUMBER,
      wait: REQUEST_RETRY_WAIT,
      backoff: REQUEST_RETRY_WAIT_BACKOFF
    };
    this.options = Object.assign({}, defaultOptions, options);
    this.networkId = void 0;
  }
  async getNetworkId() {
    if (this.networkId) return this.networkId;
    const { chain_id } = await this.viewNodeStatus();
    this.networkId = chain_id;
    return this.networkId;
  }
  async getCurrentEpochSeatPrice() {
    const { minimum_stake_ratio: minStakeRatio, protocol_version: protocolVersion } = await this.experimental_protocolConfig({ finality: DEFAULT_FINALITY });
    if (!Array.isArray(minStakeRatio))
      throw new Error("minimum_stake_ratio is not available on this protocol version");
    const { current_validators: currentValidators } = await this.viewValidators();
    const maxNumberOfSeats = 300;
    return findSeatPrice(currentValidators, maxNumberOfSeats, minStakeRatio, protocolVersion);
  }
  async getNextEpochSeatPrice() {
    const { minimum_stake_ratio: minStakeRatio, protocol_version: protocolVersion } = await this.experimental_protocolConfig({ finality: DEFAULT_FINALITY });
    if (!Array.isArray(minStakeRatio))
      throw new Error("minimum_stake_ratio is not available on this protocol version");
    const { next_validators: nextValidators } = await this.viewValidators();
    const maxNumberOfSeats = 300;
    return findSeatPrice(nextValidators, maxNumberOfSeats, minStakeRatio, protocolVersion);
  }
  async viewAccessKey({
    accountId,
    publicKey,
    finalityQuery = { finality: DEFAULT_FINALITY }
  }) {
    const data = await this.query({
      finality: finalityQuery.finality,
      request_type: "view_access_key",
      account_id: accountId,
      public_key: publicKey.toString()
    });
    return {
      ...data,
      nonce: BigInt(data.nonce)
    };
  }
  async viewAccessKeyList({
    accountId,
    finalityQuery = { finality: DEFAULT_FINALITY }
  }) {
    return this.query({
      finality: finalityQuery.finality,
      request_type: "view_access_key_list",
      account_id: accountId
    });
  }
  /**
   * Returns the current nonce of each lane of a gas key
   */
  async viewGasKeyNonces({
    accountId,
    publicKey,
    finalityQuery = { finality: DEFAULT_FINALITY }
  }) {
    return this.query({
      finality: finalityQuery.finality,
      request_type: "view_gas_key_nonces",
      account_id: accountId,
      public_key: publicKey.toString()
    });
  }
  async viewAccount({ accountId, blockQuery = { finality: DEFAULT_FINALITY } }) {
    let reference;
    if ("blockId" in blockQuery) {
      reference = { block_id: blockQuery.blockId };
    } else if ("finality" in blockQuery) {
      reference = { finality: blockQuery.finality };
    } else {
      throw new Error("Either blockId or finality must be provided in blockQuery");
    }
    const data = await this.query({
      ...reference,
      request_type: "view_account",
      account_id: accountId
    });
    return {
      ...data,
      amount: BigInt(data.amount),
      locked: BigInt(data.locked)
    };
  }
  async viewContractCode({ contractId, blockQuery = { finality: DEFAULT_FINALITY } }) {
    let reference;
    if ("blockId" in blockQuery) {
      reference = { block_id: blockQuery.blockId };
    } else if ("finality" in blockQuery) {
      reference = { finality: blockQuery.finality };
    } else {
      throw new Error("Either blockId or finality must be provided in blockQuery");
    }
    const data = await this.query({
      ...reference,
      request_type: "view_code",
      account_id: contractId
    });
    return {
      ...data,
      code: base64Decode(data.code_base64)
    };
  }
  async viewGlobalContractCode({
    identifier,
    blockQuery = { finality: DEFAULT_FINALITY }
  }) {
    let data;
    let reference;
    if ("blockId" in blockQuery) {
      reference = { block_id: blockQuery.blockId };
    } else if ("finality" in blockQuery) {
      reference = { finality: blockQuery.finality };
    } else {
      throw new Error("Either blockId or finality must be provided in blockQuery");
    }
    if ("codeHash" in identifier) {
      data = await this.query({
        ...reference,
        request_type: "view_global_contract_code",
        code_hash: typeof identifier.codeHash === "string" ? identifier.codeHash : Array.from(identifier.codeHash, (b) => b.toString(16).padStart(2, "0")).join("")
      });
    } else if ("accountId" in identifier) {
      data = await this.query({
        ...reference,
        request_type: "view_global_contract_code_by_account_id",
        account_id: identifier.accountId
      });
    } else {
      throw new Error('Either "codeHash", or "accountId" must be provided in identifier');
    }
    return {
      ...data,
      code: base64Decode(data.code_base64)
    };
  }
  async viewContractState({
    contractId,
    prefix,
    blockQuery = { finality: DEFAULT_FINALITY }
  }) {
    const prefixBase64 = base64Encode(stringToBytes(prefix || ""));
    let reference;
    if ("blockId" in blockQuery) {
      reference = { block_id: blockQuery.blockId };
    } else if ("finality" in blockQuery) {
      reference = { finality: blockQuery.finality };
    } else {
      throw new Error("Either blockId or finality must be provided in blockQuery");
    }
    return await this.query({
      ...reference,
      request_type: "view_state",
      account_id: contractId,
      prefix_base64: prefixBase64
    });
  }
  async callFunction({
    contractId,
    method,
    args,
    blockQuery = { finality: DEFAULT_FINALITY }
  }) {
    const { result } = await this.callFunctionRaw({ contractId, method, args, blockQuery });
    if (result.length === 0) return void 0;
    const serializedResult = bytesToString(new Uint8Array(result));
    try {
      return JSON.parse(serializedResult);
    } catch {
      return serializedResult;
    }
  }
  async callFunctionRaw({
    contractId,
    method,
    args,
    blockQuery = { finality: DEFAULT_FINALITY }
  }) {
    const argsBytes = args instanceof Uint8Array ? args : stringToBytes(JSON.stringify(args));
    const argsBase64 = base64Encode(argsBytes);
    if ("blockId" in blockQuery) {
      return this.query({
        request_type: "call_function",
        account_id: contractId,
        method_name: method,
        args_base64: argsBase64,
        block_id: blockQuery.blockId
      });
    } else if ("finality" in blockQuery) {
      return this.query({
        request_type: "call_function",
        account_id: contractId,
        method_name: method,
        args_base64: argsBase64,
        finality: blockQuery.finality
      });
    } else {
      throw new Error("Either blockId or finality must be provided in blockQuery");
    }
  }
  async viewBlock(blockQuery) {
    const { finality } = blockQuery;
    const { blockId } = blockQuery;
    return this.sendJsonRpc("block", { block_id: blockId, finality });
  }
  async viewChunk(chunkId) {
    return this.sendJsonRpc("chunk", [chunkId]);
  }
  async viewGasPrice(blockId) {
    return this.sendJsonRpc("gas_price", [blockId || null]);
  }
  async viewNodeStatus() {
    return this.sendJsonRpc("status", []);
  }
  /**
   * Query validators of an epoch.
   * @see [https://docs.near.org/api/rpc/network#validation-status](https://docs.near.org/api/rpc/network#validation-status)
   *
   * @param params Object specifying either a block or epoch to query.
   * - `{ blockId }`: Block hash or height.
   * - `{ epochId }`: Epoch hash.
   * - `null`: Current epoch.
   */
  async viewValidators(params) {
    if (typeof params === "undefined") return this.sendJsonRpc("validators", [null]);
    if (typeof params === "object" && "blockId" in params)
      return this.sendJsonRpc("validators", { block_id: params.blockId });
    if (typeof params === "object" && "epochId" in params)
      return this.sendJsonRpc("validators", { epoch_id: params.epochId });
    throw new Error("Invalid parameters for validators");
  }
  async viewTransactionStatus({
    txHash,
    accountId,
    waitUntil = "EXECUTED_OPTIMISTIC"
  }) {
    const encodedTxHash = typeof txHash === "string" ? txHash : baseEncode(txHash);
    return this.sendJsonRpc("tx", {
      tx_hash: encodedTxHash,
      sender_account_id: accountId,
      wait_until: waitUntil
    });
  }
  async viewTransactionStatusWithReceipts({
    txHash,
    accountId,
    waitUntil = "EXECUTED_OPTIMISTIC"
  }) {
    const encodedTxHash = typeof txHash === "string" ? txHash : baseEncode(txHash);
    return this.sendJsonRpc("EXPERIMENTAL_tx_status", {
      tx_hash: encodedTxHash,
      sender_account_id: accountId,
      wait_until: waitUntil
    });
  }
  async viewTransactionReceipt(receiptId) {
    return this.sendJsonRpc("EXPERIMENTAL_receipt", {
      receipt_id: receiptId
    });
  }
  /**
   * Sends a signed transaction to the RPC
   *
   * @param signedTransaction The signed transaction being sent
   * @param waitUntil
   */
  async sendTransactionUntil(signedTransaction, waitUntil) {
    const bytes = encodeTransaction(signedTransaction);
    return this.sendJsonRpc("send_tx", {
      signed_tx_base64: base64Encode(bytes),
      wait_until: waitUntil
    });
  }
  /**
   * Sends a signed transaction to the RPC and waits until transaction is fully complete
   * @see [https://docs.near.org/docs/develop/front-end/rpc#send-transaction-await](https://docs.near.org/docs/develop/front-end/rpc#general-validator-status)
   *
   * @param signedTransaction The signed transaction being sent
   */
  async sendTransaction(signedTransaction) {
    return this.sendTransactionUntil(signedTransaction, "EXECUTED_OPTIMISTIC");
  }
  /**
   * Sends a signed transaction to the RPC and immediately returns transaction hash
   * See [docs for more info](https://docs.near.org/docs/develop/front-end/rpc#send-transaction-async)
   * @param signedTransaction The signed transaction being sent
   * @returns {Promise<FinalExecutionOutcome>}
   */
  async sendTransactionAsync(signedTransaction) {
    return this.sendTransactionUntil(signedTransaction, "NONE");
  }
  /**
   * Query the RPC by passing an {@link RpcQueryRequest }
   * @see [https://docs.near.org/api/rpc/contracts](https://docs.near.org/api/rpc/contracts)
   *
   */
  async query(params) {
    return this.sendJsonRpc("query", params);
  }
  /**
   * Query changes in block from the RPC
   * pass block_id OR finality as blockQuery, not both
   * @see [https://docs.near.org/api/rpc/block-chunk](https://docs.near.org/api/rpc/block-chunk)
   */
  async blockChanges(blockQuery) {
    const { finality } = blockQuery;
    const { blockId } = blockQuery;
    return this.sendJsonRpc("EXPERIMENTAL_changes_in_block", { block_id: blockId, finality });
  }
  /**
   * Gets the protocol config at a block from RPC
   *
   * @param blockReference specifies the block to get the protocol config for
   */
  async experimental_protocolConfig(blockReference) {
    const { blockId, ...otherParams } = blockReference;
    return await this.sendJsonRpc("EXPERIMENTAL_protocol_config", { ...otherParams, block_id: blockId });
  }
  /**
   * Gets a light client execution proof for verifying execution outcomes
   * @see [https://github.com/nearprotocol/NEPs/blob/master/specs/ChainSpec/LightClient.md#light-client-proof](https://github.com/nearprotocol/NEPs/blob/master/specs/ChainSpec/LightClient.md#light-client-proof)
   */
  async lightClientProof(request) {
    return await this.sendJsonRpc("EXPERIMENTAL_light_client_proof", request);
  }
  /**
   * Returns the next light client block as far in the future as possible from the last known hash
   * to still be able to validate from that hash. This will either return the last block of the
   * next epoch, or the last final known block.
   *
   * @see [https://github.com/near/NEPs/blob/master/specs/ChainSpec/LightClient.md#light-client-block](https://github.com/near/NEPs/blob/master/specs/ChainSpec/LightClient.md#light-client-block)
   */
  async nextLightClientBlock(request) {
    return await this.sendJsonRpc("next_light_client_block", request);
  }
  /**
   * Gets access key changes for a given array of accountIds
   * See [docs for more info](https://docs.near.org/docs/develop/front-end/rpc#view-access-key-changes-all)
   */
  async accessKeyChanges(accountIdArray, blockQuery) {
    const { finality } = blockQuery;
    const { blockId } = blockQuery;
    return this.sendJsonRpc("EXPERIMENTAL_changes", {
      changes_type: "all_access_key_changes",
      account_ids: accountIdArray,
      block_id: blockId,
      finality
    });
  }
  /**
   * Gets single access key changes for a given array of access keys
   * pass block_id OR finality as blockQuery, not both
   * See [docs for more info](https://docs.near.org/docs/develop/front-end/rpc#view-access-key-changes-single)
   */
  async singleAccessKeyChanges(accessKeyArray, blockQuery) {
    const { finality } = blockQuery;
    const { blockId } = blockQuery;
    return this.sendJsonRpc("EXPERIMENTAL_changes", {
      changes_type: "single_access_key_changes",
      keys: accessKeyArray,
      block_id: blockId,
      finality
    });
  }
  /**
   * Gets account changes for a given array of accountIds
   * pass block_id OR finality as blockQuery, not both
   * See [docs for more info](https://docs.near.org/docs/develop/front-end/rpc#view-account-changes)
   */
  async accountChanges(accountIdArray, blockQuery) {
    const { finality } = blockQuery;
    const { blockId } = blockQuery;
    return this.sendJsonRpc("EXPERIMENTAL_changes", {
      changes_type: "account_changes",
      account_ids: accountIdArray,
      block_id: blockId,
      finality
    });
  }
  /**
   * Gets contract state changes for a given array of accountIds
   * pass block_id OR finality as blockQuery, not both
   * Note: If you pass a keyPrefix it must be base64 encoded
   * See [docs for more info](https://docs.near.org/docs/develop/front-end/rpc#view-contract-state-changes)
   */
  async contractStateChanges(accountIdArray, blockQuery, keyPrefix = "") {
    const { finality } = blockQuery;
    const { blockId } = blockQuery;
    return this.sendJsonRpc("EXPERIMENTAL_changes", {
      changes_type: "data_changes",
      account_ids: accountIdArray,
      key_prefix_base64: keyPrefix,
      block_id: blockId,
      finality
    });
  }
  /**
   * Gets contract code changes for a given array of accountIds
   * pass block_id OR finality as blockQuery, not both
   * Note: Change is returned in a base64 encoded WASM file
   * See [docs for more info](https://docs.near.org/docs/develop/front-end/rpc#view-contract-code-changes)
   */
  async contractCodeChanges(accountIdArray, blockQuery) {
    const { finality } = blockQuery;
    const { blockId } = blockQuery;
    return this.sendJsonRpc("EXPERIMENTAL_changes", {
      changes_type: "contract_code_changes",
      account_ids: accountIdArray,
      block_id: blockId,
      finality
    });
  }
  /**
   * Directly call the RPC specifying the method and params
   *
   * @param method RPC method
   * @param params Parameters to the method
   */
  async sendJsonRpc(method, params) {
    const request = {
      method,
      params,
      id: String(_nextId++),
      jsonrpc: "2.0"
    };
    const response = await fetchJsonRpc(
      this.connection.url,
      request,
      this.connection.headers || {},
      retryConfig(this.options.retries, this.options.backoff, this.options.wait)
    );
    if ("error" in response && typeof response.error !== "undefined") {
      throw parseRpcError(response.error);
    }
    if (!("result" in response)) {
      throw new Error(`JSON RPC response must include either "result", or "error" property`);
    }
    const { result } = response;
    if (typeof result === "undefined") {
      throw new TypedError(
        `Exceeded ${this.options.retries} attempts for request to ${method}.`,
        "RetriesExceeded"
      );
    }
    if (response.result === null) return null;
    if (typeof response.result === "object" && "error" in response.result && typeof response.result.error === "string") {
      if ("block_hash" in response.result && "block_height" in response.result) {
        throw parseRpcErrorMessage(
          response.result.error,
          response.result.block_hash,
          response.result.block_height
        );
      } else {
        throw new RpcError(response.result.error);
      }
    }
    return result;
  }
};
var Nep413MessageSchema = {
  struct: {
    message: "string",
    nonce: { array: { type: "u8", len: 32 } },
    recipient: "string",
    callbackUrl: { option: "string" }
  }
};
function serializeMessage(payload) {
  const PREFIX = 2147484061;
  const serializedPrefix = serialize("u32", PREFIX);
  const serializedParams = serialize(Nep413MessageSchema, payload);
  const serializedPayload = new Uint8Array(serializedPrefix.length + serializedParams.length);
  serializedPayload.set(serializedPrefix);
  serializedPayload.set(serializedParams, serializedPrefix.length);
  return new Uint8Array(sha256(serializedPayload));
}
var Signer = class {
  /**
   * Signs given message according to NEP-413 requirements
   * @see https://github.com/near/NEPs/blob/master/neps/nep-0413.md
   *
   * @param accountId - The account name to which the public key corresponds (e.g. "alice.near").
   * @param params - The parameters including message, recipient, nonce, and optional callbackUrl.
   */
  async signNep413Message(accountId, params) {
    if (params.nonce.length !== 32) throw new Error("Nonce must be exactly 32 bytes long");
    const hash = serializeMessage(params);
    const signature = await this.signBytes(hash);
    return {
      accountId,
      publicKey: await this.getPublicKey(),
      signature,
      state: params.callbackUrl
    };
  }
  /**
   * Signs given transaction.
   * @param transaction - The transaction to sign.
   * @returns {Promise<[Uint8Array, SignedTransaction]>} - Promise of the hash that can be verified and signed transaction.
   */
  async signTransaction(transaction) {
    const pk = await this.getPublicKey();
    if (transaction.publicKey.toString() !== pk.toString())
      throw new Error("The public key doesn't match the signer's key");
    const serializedTx = encodeTransaction(transaction);
    const txHash = new Uint8Array(sha256(serializedTx));
    const signature = await this.signBytes(txHash);
    const signedTx = new SignedTransaction({
      transaction,
      signature: new Signature({
        keyType: transaction.publicKey.keyType,
        data: signature
      })
    });
    return { txHash, signedTransaction: signedTx };
  }
  /**
   * Signs given delegate action.
   * @param delegateAction - The delegate action to sign.
   * @returns {Promise<[Uint8Array, SignedDelegate]>} - Promise of the hash that can be verified and signed delegate action.
   */
  async signDelegateAction(delegateAction) {
    const pk = await this.getPublicKey();
    if (delegateAction.publicKey.toString() !== pk.toString())
      throw new Error("The public key doesn't match the signer's key");
    const serializedDelegate = encodeDelegateAction(delegateAction);
    const delegateHash = new Uint8Array(sha256(serializedDelegate));
    const signature = await this.signBytes(delegateHash);
    const signedDelegate22 = new SignedDelegate({
      delegateAction,
      signature: new Signature({
        keyType: pk.keyType,
        data: signature
      })
    });
    return { delegateHash, signedDelegate: signedDelegate22 };
  }
};
var KeyPairSigner = class _KeyPairSigner extends Signer {
  constructor(key) {
    super();
    this.key = key;
  }
  static fromSecretKey(encodedKey) {
    const key = KeyPair.fromString(encodedKey);
    return new _KeyPairSigner(key);
  }
  async getPublicKey() {
    return this.key.getPublicKey();
  }
  async signBytes(bytes) {
    const { signature } = this.key.sign(bytes);
    return new Uint8Array(signature);
  }
};
function toUnits(amount, exponent) {
  const cleanedAmount = cleanupAmount2(`${amount}`);
  if (!cleanedAmount) {
    throw new Error("Amount cannot be empty");
  }
  const split2 = cleanedAmount.split(".");
  const wholePart = split2[0];
  const fracPart = split2[1] || "";
  if (split2.length > 2 || fracPart.length > exponent) {
    throw new Error(`Cannot parse '${amount}'`);
  }
  return BigInt(trimLeadingZeroes2(wholePart + fracPart.padEnd(exponent, "0")));
}
function cleanupAmount2(amount) {
  return amount.replace(/,/g, "").trim();
}
function trimLeadingZeroes2(value) {
  value = value.replace(/^0+/, "");
  if (value === "") {
    return "0";
  }
  return value;
}
var TERA_NOMINATION_EXP = 12;
function teraToGas(tera) {
  return toUnits(tera, TERA_NOMINATION_EXP);
}
var MAX_NOMINATION_EXP = 24;
function formatAmount(units, fracDigits, precision = fracDigits) {
  units = cleanupUnits(units);
  const wholeStr = units.substring(0, units.length - fracDigits) || "0";
  let fractionStr = units.substring(units.length - fracDigits).substring(0, fracDigits).padStart(fracDigits, "0");
  fractionStr = fractionStr.substring(0, precision);
  return trimTrailingZeroes2(`${wholeStr}.${fractionStr}`);
}
function parseAmount(amount, fracDigits) {
  amount = cleanupAmount3(amount);
  const split2 = amount.split(".");
  if (split2.length > 2) {
    throw new Error(`Cannot parse amount '${amount}' as it contains more than a single dot`);
  }
  const wholePart = split2[0];
  const fracPart = split2[1] || "";
  if (fracPart.length > MAX_NOMINATION_EXP) {
    throw new Error(
      `Cannot parse amount '${amount}' as it exceeds maximum decimal precision of ${MAX_NOMINATION_EXP}`
    );
  }
  return trimLeadingZeroes3(wholePart + fracPart.substring(0, fracDigits).padEnd(fracDigits, "0"));
}
function cleanupAmount3(amount) {
  return amount.replace(/,/g, ".").trim();
}
function trimTrailingZeroes2(value) {
  return value.replace(/\.?0*$/, "");
}
function trimLeadingZeroes3(value) {
  value = value.replace(/^0+/, "");
  if (value === "") {
    return "0";
  }
  return value;
}
function cleanupUnits(amount) {
  return BigInt(amount).toString();
}
var BaseFT = class {
  constructor(metadata) {
    this.metadata = metadata;
  }
  /**
   * Converts a decimal number to indivisible units
   *
   * @param amount The amount in decimal format (e.g. "1.234")
   * @returns The amount in indivisible units (e.g. "1234")
   */
  toUnits(amount) {
    const units = parseAmount(amount.toString(), this.metadata.decimals);
    return BigInt(units);
  }
  /**
   * Converts indivisible units to a decimal number (represented as a string)
   *
   * @param amount The amount in indivisible units (e.g. "1234")
   * @param precision (optional) number of digits shown to the right of the decimal point - rounded down
   * @returns The amount as a decimal string (e.g. "1.234")
   */
  toDecimal(amount, precision) {
    return formatAmount(amount, this.metadata.decimals, precision);
  }
};
var NativeToken = class extends BaseFT {
  async transfer({
    from,
    receiverId,
    amount
  }) {
    return from.signAndSendTransaction({
      receiverId,
      actions: [actions.transfer(BigInt(amount))]
    });
  }
  async getBalance(account) {
    const {
      balance: { available }
    } = await account.getState();
    return available;
  }
};
var FungibleToken = class extends BaseFT {
  constructor(accountId, metadata) {
    metadata.spec = metadata.spec || "ft-1.0.0";
    super(metadata);
    this.accountId = accountId;
  }
  async transfer({
    from,
    receiverId,
    amount
  }) {
    return from.callFunction({
      contractId: this.accountId,
      methodName: "ft_transfer",
      args: {
        amount: amount.toString(),
        receiver_id: receiverId
      },
      gas: teraToGas(30),
      deposit: 1
    });
  }
  async getBalance({ accountId, provider }) {
    const balance = await provider.callFunction({
      contractId: this.accountId,
      method: "ft_balance_of",
      args: { account_id: accountId }
    });
    return BigInt(balance);
  }
  /**
   * Transfer tokens and call a function on the receiver contract,
   * only works if the receiver implements the `ft_on_transfer` method
   *
   * @param param Transfer call parameters
   * @param param.from The Account that will transfer the tokens
   * @param param.receiverId The AccountID that will receive the tokens
   * @param param.amount The amount of tokens to transfer in the smallest unit
   * @param param.msg The message to send to the `ft_on_transfer` method
   */
  async transferCall({
    from,
    receiverId,
    amount,
    msg
  }) {
    return from.callFunction({
      contractId: this.accountId,
      methodName: "ft_transfer_call",
      args: {
        receiver_id: receiverId,
        amount: amount.toString(),
        msg
      },
      gas: teraToGas(30),
      deposit: 1
    });
  }
  /**
   * Register an account to the fungible token contract by paying a storage deposit
   *
   * @param param
   * @param param.accountIdToRegister The AccountID to register
   * @param param.fundingAccount The Account that will fund the registration
   */
  async registerAccount({
    accountIdToRegister,
    fundingAccount
  }) {
    const bounds = await fundingAccount.provider.callFunction({
      contractId: this.accountId,
      method: "storage_balance_bounds",
      args: {}
    });
    const requiredDeposit = bounds.min;
    return fundingAccount.callFunction({
      contractId: this.accountId,
      methodName: "storage_deposit",
      args: {
        account_id: accountIdToRegister,
        registration_only: true
      },
      gas: teraToGas(30),
      deposit: requiredDeposit
    });
  }
  /**
   * Unregister an account from the fungible token contract by paying a storage deposit
   *
   * @param param
   * @param param.account The Account to unregister
   * @param param.force Whether to remove the account without claiming the storage deposit
   */
  async unregisterAccount({ account, force = false }) {
    return account.callFunction({
      contractId: this.accountId,
      methodName: "storage_unregister",
      args: { force },
      gas: teraToGas(30),
      deposit: 1
    });
  }
  /**
   * Checks if an account is registered to the fungible token contract
   *
   * @param param
   * @param param.accountId The AccountID to check
   * @param param.provider A Provider to use for the query
   * @returns Whether the account is registered
   */
  async isAccountRegistered({
    accountId,
    provider
  }) {
    const [storage, required] = await Promise.all([
      provider.callFunction({
        contractId: this.accountId,
        method: "storage_balance_of",
        args: { account_id: accountId }
      }),
      provider.callFunction({
        contractId: this.accountId,
        method: "storage_balance_bounds",
        args: {}
      })
    ]);
    if (!storage) return false;
    return BigInt(storage.total) >= BigInt(required.min);
  }
};
var NEAR = new NativeToken({
  name: "NEAR",
  decimals: 24,
  symbol: "NEAR",
  icon: "data:image/svg+xml,%3Csvg%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2216%22%20fill%3D%22white%22%3E%3C%2Fcircle%3E%3Cg%20clip-path%3D%22url(%23clip0000000003)%22%3E%3Cpath%20d%3D%22M20.8422%208.84471L17.4978%2013.776C17.4501%2013.847%2017.43%2013.9328%2017.4411%2014.0174C17.4522%2014.102%2017.4938%2014.1798%2017.5582%2014.2363C17.6225%2014.2928%2017.7053%2014.3243%2017.7913%2014.3249C17.8772%2014.3254%2017.9604%2014.2951%2018.0256%2014.2395L21.3178%2011.4036C21.3371%2011.3865%2021.361%2011.3753%2021.3866%2011.3714C21.4122%2011.3675%2021.4383%2011.3711%2021.4619%2011.3818C21.4855%2011.3924%2021.5054%2011.4096%2021.5193%2011.4314C21.5331%2011.4531%2021.5403%2011.4783%2021.54%2011.504V20.3824C21.54%2020.4095%2021.5316%2020.4361%2021.5158%2020.4583C21.5001%2020.4806%2021.4779%2020.4975%2021.4522%2020.5068C21.4265%2020.516%2021.3985%2020.5172%2021.3721%2020.5102C21.3456%2020.5031%2021.322%2020.4882%2021.3044%2020.4673L11.3533%208.63726C11.1933%208.44956%2010.994%208.29873%2010.7693%208.19525C10.5446%208.09178%2010.2999%208.03815%2010.0522%208.03809H9.70444C9.2524%208.03809%208.81887%208.21642%208.49922%208.53386C8.17957%208.8513%208%209.28185%208%209.73078V22.2351C8%2022.684%208.17957%2023.1145%208.49922%2023.432C8.81887%2023.7494%209.2524%2023.9277%209.70444%2023.9277V23.9277C9.99591%2023.9278%2010.2825%2023.8537%2010.537%2023.7125C10.7914%2023.5713%2011.0051%2023.3677%2011.1578%2023.1211L14.5022%2018.1898C14.5499%2018.1188%2014.57%2018.033%2014.5589%2017.9484C14.5478%2017.8638%2014.5062%2017.7861%2014.4418%2017.7295C14.3775%2017.673%2014.2947%2017.6415%2014.2087%2017.641C14.1228%2017.6404%2014.0396%2017.6707%2013.9744%2017.7264L10.6822%2020.5622C10.6629%2020.5794%2010.639%2020.5906%2010.6134%2020.5944C10.5878%2020.5983%2010.5617%2020.5947%2010.5381%2020.5841C10.5145%2020.5734%2010.4946%2020.5562%2010.4807%2020.5345C10.4669%2020.5128%2010.4597%2020.4875%2010.46%2020.4618V11.5813C10.46%2011.5541%2010.4684%2011.5276%2010.4842%2011.5053C10.4999%2011.483%2010.5221%2011.4661%2010.5478%2011.4568C10.5735%2011.4476%2010.6015%2011.4464%2010.6279%2011.4534C10.6544%2011.4605%2010.678%2011.4755%2010.6956%2011.4963L20.6456%2023.3286C20.8056%2023.5163%2021.0049%2023.6671%2021.2296%2023.7706C21.4543%2023.874%2021.699%2023.9277%2021.9467%2023.9277H22.2944C22.5184%2023.9279%2022.7401%2023.8842%2022.947%2023.7992C23.154%2023.7142%2023.342%2023.5895%2023.5004%2023.4324C23.6588%2023.2752%2023.7844%2023.0885%2023.8702%2022.8831C23.9559%2022.6776%2024%2022.4574%2024%2022.2351V9.73078C24%209.28185%2023.8204%208.8513%2023.5008%208.53386C23.1811%208.21642%2022.7476%208.03809%2022.2956%208.03809C22.0041%208.03801%2021.7175%208.11211%2021.4631%208.25332C21.2086%208.39453%2020.9949%208.59814%2020.8422%208.84471V8.84471Z%22%20fill%3D%22black%22%3E%3C%2Fpath%3E%3C%2Fg%3E%3Cdefs%3E%3CclipPath%20id%3D%22clip00033%22%3E%3Crect%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22black%22%20transform%3D%22translate(8%207.9834)%22%3E%3C%2Frect%3E%3C%2FclipPath%3E%3C%2Fdefs%3E%3C%2Fsvg%3E"
});
var NonceManager = class {
  constructor() {
    this.states = {};
    this.locks = {};
  }
  /** Select a gas key lane, if needed, and reserve the next nonce. */
  async resolveNextNonce(pk, accountId, provider) {
    const key = pk.toString();
    const params = { accountId, publicKey: pk, finalityQuery: { finality: "optimistic" } };
    return this.withLock(key, async () => {
      let state = this.states[key];
      if (!state) {
        const { nonce: nonce2, permission } = await provider.viewAccessKey(params);
        if (typeof permission === "object" && permission !== null && ("GasKeyFullAccess" in permission || "GasKeyFunctionCall" in permission)) {
          const { nonces } = await provider.viewGasKeyNonces(params);
          if (nonces.length === 0) throw new Error(`Gas key ${pk} has no nonce lanes`);
          state = { nonces: nonces.map((value) => BigInt(value)), nextLane: 0 };
        } else {
          state = { nonces: [nonce2] };
        }
        this.states[key] = state;
      }
      const nonceIndex = state.nextLane;
      const lane = nonceIndex ?? 0;
      let nonce = state.nonces[lane];
      if (nonce === void 0) {
        const { nonces } = await provider.viewGasKeyNonces(params);
        const chainNonce = nonces[lane];
        if (chainNonce === void 0) throw new Error(`Nonce lane ${lane} does not exist on gas key ${pk}`);
        nonce = BigInt(chainNonce);
      }
      state.nonces[lane] = nonce + 1n;
      if (nonceIndex !== void 0) {
        state.nextLane = (lane + 1) % state.nonces.length;
        return { nonce: nonce + 1n, nonceIndex };
      }
      return { nonce: nonce + 1n };
    });
  }
  async invalidate(pk, nonceIndex) {
    const key = pk.toString();
    return this.withLock(key, () => {
      const state = this.states[key];
      if (state && nonceIndex !== void 0) {
        state.nonces[nonceIndex] = void 0;
      } else {
        delete this.states[key];
      }
    });
  }
  async withLock(key, getResult) {
    const previous = this.locks[key];
    let unlock = () => {
    };
    const lock = new Promise((resolve) => {
      unlock = resolve;
    });
    this.locks[key] = lock;
    await previous;
    try {
      return await getResult();
    } finally {
      unlock();
      if (this.locks[key] === lock) delete this.locks[key];
    }
  }
};
var {
  addFullAccessGasKey: addFullAccessGasKey2,
  addFullAccessKey: addFullAccessKey2,
  addFunctionCallAccessKey: addFunctionCallAccessKey2,
  addFunctionCallGasKey: addFunctionCallGasKey2,
  createAccount: createAccount3,
  deleteAccount: deleteAccount3,
  deleteKey: deleteKey3,
  deployContract: deployContract3,
  deployGlobalContract: deployGlobalContract3,
  functionCall: functionCall3,
  transfer: transfer3,
  transferToGasKey: transferToGasKey2,
  useGlobalContract: useGlobalContract3,
  withdrawFromGasKey: withdrawFromGasKey2
} = actions;
var DEFAULT_FINALITY2 = "optimistic";
var DEFAULT_WAIT_STATUS = "EXECUTED_OPTIMISTIC";
var DEFAULT_FUNCTION_CALL_GAS = 30000000000000n;
var Account = class {
  constructor(accountId, provider, signer) {
    this.accountId = accountId;
    if (typeof provider === "string") {
      this.provider = new JsonRpcProvider({ url: provider });
    } else {
      this.provider = provider;
    }
    if (typeof signer === "string") {
      this.signer = KeyPairSigner.fromSecretKey(signer);
    } else {
      this.signer = signer;
    }
    this.nonceManager = new NonceManager();
  }
  /**
   * Allows to set the signer used to control the account
   *
   * @param signer holds the private key and can sign Transactions
   */
  setSigner(signer) {
    this.signer = signer;
  }
  getSigner() {
    return this.signer;
  }
  /**
   * Returns an overview of the account's state, including the account's
   * balance, storage usage, and code hash
   */
  async getState() {
    const [protocolConfig, state] = await Promise.all([
      this.provider.experimental_protocolConfig({
        finality: DEFAULT_FINALITY2
      }),
      this.provider.viewAccount({
        accountId: this.accountId,
        blockQuery: {
          finality: DEFAULT_FINALITY2
        }
      })
    ]);
    if (typeof protocolConfig.runtime_config !== "object" || protocolConfig.runtime_config === null)
      throw new Error("runtime_config is not defined in protocol config");
    if (typeof protocolConfig.runtime_config.storage_amount_per_byte === "undefined")
      throw new Error("runtime_config.storage_amount_per_byte is not defined in protocol config");
    const costPerByte = BigInt(protocolConfig.runtime_config.storage_amount_per_byte);
    const usedOnStorage = BigInt(state.storage_usage) * costPerByte;
    const locked = BigInt(state.locked);
    const total = BigInt(state.amount) + locked;
    const available = total - (locked > usedOnStorage ? locked : usedOnStorage);
    return {
      balance: {
        total,
        usedOnStorage,
        locked,
        available
      },
      storageUsage: state.storage_usage,
      codeHash: state.code_hash
    };
  }
  /**
   * Calls {@link Provider.viewAccessKey} to retrieve information for a
   * specific key in the account
   */
  async getAccessKey(publicKey) {
    return this.provider.viewAccessKey({
      accountId: this.accountId,
      publicKey,
      finalityQuery: {
        finality: DEFAULT_FINALITY2
      }
    });
  }
  /**
   * Calls {@link Provider.viewAccessKeyList} to retrieve the account's keys
   */
  async getAccessKeyList() {
    return this.provider.viewAccessKeyList({
      accountId: this.accountId,
      finalityQuery: {
        finality: DEFAULT_FINALITY2
      }
    });
  }
  /**
   * Calls {@link Provider.viewContractCode} to retrieve the account's
   * contract code and its hash
   */
  async getContractCode() {
    return this.provider.viewContractCode({
      contractId: this.accountId,
      blockQuery: {
        finality: DEFAULT_FINALITY2
      }
    });
  }
  /**
   * Calls {@link Provider.viewContractState} to retrieve the keys and values
   * stored on the account's contract
   */
  async getContractState(prefix) {
    return this.provider.viewContractState({
      contractId: this.accountId,
      prefix,
      blockQuery: {
        finality: DEFAULT_FINALITY2
      }
    });
  }
  /**
   * Create a transaction that can be later signed with a {@link Signer}
   *
   * @param options Transaction options
   * @param options.receiverId Account against which to perform the actions
   * @param options.actions Actions to perform
   * @param options.publicKey The public part of the key that will be used to sign the transaction
   */
  async createTransaction({ receiverId, actions: actions22, publicKey }) {
    if (!publicKey) throw new Error("Please provide a public key");
    const pk = PublicKey.from(publicKey);
    const [{ nonce, nonceIndex }, block] = await Promise.all([
      this.nonceManager.resolveNextNonce(pk, this.accountId, this.provider),
      this.provider.viewBlock({
        // block hash referenced in tx must be finalized
        // to ensure node has it in memory
        finality: "final"
      })
    ]);
    const recentBlockHash = block.header.hash;
    return createTransaction(
      this.accountId,
      pk,
      receiverId,
      nonce,
      actions22,
      baseDecode(recentBlockHash),
      nonceIndex
    );
  }
  /**
   * Create a signed transaction ready to be broadcast by a {@link Provider}
   */
  async createSignedTransaction({
    receiverId,
    actions: actions22,
    signer = this.signer
  }) {
    if (!signer) throw new Error("Please set a signer");
    const tx = await this.createTransaction({
      receiverId,
      actions: actions22,
      publicKey: await signer.getPublicKey()
    });
    const { signedTransaction } = await signer.signTransaction(tx);
    return signedTransaction;
  }
  /**
   * Create a meta transaction ready to be signed by a {@link Signer}
   *
   * @param options Meta transaction options
   * @param options.receiverId NEAR account receiving the transaction
   * @param options.actions list of actions to perform as part of the meta transaction
   * @param options.blockHeightTtl number of blocks after which a meta transaction will expire if not processed
   */
  async createMetaTransaction({
    receiverId,
    actions: actions22,
    blockHeightTtl = 200,
    publicKey
  }) {
    if (!publicKey) throw new Error("Please provide a public key");
    const pk = PublicKey.from(publicKey);
    const [accessKey, block] = await Promise.all([
      this.getAccessKey(pk),
      this.provider.viewBlock({
        finality: DEFAULT_FINALITY2
      })
    ]);
    const nonce = BigInt(accessKey.nonce) + 1n;
    const maxBlockHeight = BigInt(block.header.height) + BigInt(blockHeightTtl);
    return buildDelegateAction({
      receiverId,
      senderId: this.accountId,
      actions: actions22,
      publicKey: pk,
      nonce,
      maxBlockHeight
    });
  }
  /**
   * Create a signed MetaTransaction that can be broadcasted to a relayer
   *
   * @param options Signed meta transaction options
   * @param options.receiverId NEAR account receiving the transaction
   * @param options.actions list of actions to perform as part of the meta transaction
   * @param options.blockHeightTtl number of blocks after which a meta transaction will expire if not processed
   */
  async createSignedMetaTransaction({
    receiverId,
    actions: actions22,
    blockHeightTtl = 200,
    signer = this.signer
  }) {
    if (!signer) throw new Error("Please set a signer");
    const delegateAction = await this.createMetaTransaction({
      receiverId,
      actions: actions22,
      blockHeightTtl,
      publicKey: await signer.getPublicKey()
    });
    return signer.signDelegateAction(delegateAction);
  }
  /**
   * Creates a transaction, signs it and broadcast it to the network
   *
   * @param options Sign and send transaction options
   * @param options.receiverId The NEAR account ID of the transaction receiver.
   * @param options.actions The list of actions to be performed in the transaction.
   * @param options.throwOnFailure Whether to throw an error if the transaction fails.
   *
   */
  async signAndSendTransaction({
    receiverId,
    actions: actions22,
    waitUntil = DEFAULT_WAIT_STATUS,
    throwOnFailure = true,
    signer = this.signer,
    retries = 10
  }) {
    const signedTx = await this.createSignedTransaction({
      receiverId,
      actions: actions22,
      signer
    });
    let result;
    try {
      result = await this.provider.sendTransactionUntil(signedTx, waitUntil);
    } catch (error) {
      if (error instanceof InvalidNonceError) {
        await this.nonceManager.invalidate(signedTx.transaction.publicKey, signedTx.transaction.nonceIndex);
        if (retries > 0) {
          return this.signAndSendTransaction({
            receiverId,
            actions: actions22,
            waitUntil,
            throwOnFailure,
            signer,
            retries: retries - 1
          });
        }
      }
      throw error;
    }
    if (throwOnFailure && typeof result.status === "object" && result.status !== null && "Failure" in result.status && typeof result.status.Failure === "object" && result.status.Failure !== null) {
      throw parseTransactionExecutionError(
        result.status.Failure,
        result.transaction_outcome.id,
        result.transaction_outcome.block_hash,
        result
      );
    }
    return result;
  }
  async signAndSendTransactions({
    transactions,
    waitUntil = DEFAULT_WAIT_STATUS,
    throwOnFailure = true,
    signer = this.signer
  }) {
    if (!this.signer) throw new Error("Please set a signer");
    const results = await Promise.all(
      transactions.map(async ({ receiverId, actions: actions22 }) => {
        return this.signAndSendTransaction({
          receiverId,
          actions: actions22,
          waitUntil,
          throwOnFailure,
          signer
        });
      })
    );
    return results;
  }
  /**
   * Creates a new NEAR account with a given ID and public key.
   *
   * This method can create two types of accounts:
   *
   * 1. Top-level accounts of the form `name.tla` (e.g., `bob.near`):
   *
   * 2. Sub-accounts of the current account (e.g., `sub.ana.near`):
   *    - The new account ID must end with the current account ID
   *    - Example: If your account is `ana.near`, you can create `sub.ana.near`
   *
   * @param options Account creation options
   * @param options.newAccountId the new account to create (e.g. bob.near or sub.ana.near)
   * @param options.publicKey the public part of the key that will control the account
   * @param options.nearToTransfer how much NEAR to transfer to the account in yoctoNEAR (default: 0)
   *
   */
  async createAccount({ newAccountId, publicKey, nearToTransfer = 0n }) {
    if (newAccountId.endsWith(this.accountId)) {
      return this.createSubAccount({ accountOrPrefix: newAccountId, publicKey, nearToTransfer });
    }
    const splitted = newAccountId.split(".");
    if (splitted.length != 2) {
      throw new Error(
        `${this.accountId} can only create sub-accounts of itself, or accounts of the form <account>.<tla>`
      );
    }
    const TLA = splitted[1];
    return this.signAndSendTransaction({
      receiverId: TLA,
      actions: [
        functionCall3(
          "create_account",
          {
            new_account_id: newAccountId,
            new_public_key: publicKey.toString()
          },
          BigInt("60000000000000"),
          BigInt(nearToTransfer)
        )
      ]
    });
  }
  /**
   * Creates a sub account of this account. For example, if the account is
   * ana.near, you can create sub.ana.near.
   *
   * @param options Sub-account creation options
   * @param options.accountOrPrefix a prefix (e.g. `sub`) or the full sub-account (`sub.ana.near`)
   * @param options.publicKey the public part of the key that will control the account
   * @param options.nearToTransfer how much NEAR to transfer to the account (default: 0)
   *
   */
  async createSubAccount({ accountOrPrefix, publicKey, nearToTransfer = 0n }) {
    if (!this.signer) throw new Error("Please set a signer");
    const newAccountId = accountOrPrefix.includes(".") ? accountOrPrefix : `${accountOrPrefix}.${this.accountId}`;
    if (newAccountId.length > 64) {
      throw new Error("Accounts cannot exceed 64 characters");
    }
    if (!newAccountId.endsWith(this.accountId)) {
      throw new Error(`New account must end up with ${this.accountId}`);
    }
    const actions22 = [
      createAccount3(),
      transfer3(BigInt(nearToTransfer)),
      addFullAccessKey2(PublicKey.from(publicKey))
    ];
    return this.signAndSendTransaction({
      receiverId: newAccountId,
      actions: actions22
    });
  }
  /**
   * Deletes the account, transferring all remaining NEAR to a beneficiary
   * account
   *
   * Important: Deleting an account does not transfer FTs or NFTs
   *
   * @param beneficiaryId Will receive the account's remaining balance
   */
  async deleteAccount(beneficiaryId) {
    return this.signAndSendTransaction({
      receiverId: this.accountId,
      actions: [deleteAccount3(beneficiaryId)]
    });
  }
  /**
   * Deploy a smart contract in the account
   *
   * @param code The compiled contract code bytes
   */
  async deployContract(code) {
    return this.signAndSendTransaction({
      receiverId: this.accountId,
      actions: [deployContract3(code)]
    });
  }
  /**
   * Deploy a global contract that can be reused by multiple accounts
   *
   * @param code The compiled contract code bytes
   * @param deployMode Deploy mode - "codeHash" for immutable contracts, "accountId" for updateable contracts
   */
  async deployGlobalContract(code, deployMode) {
    return this.signAndSendTransaction({
      receiverId: this.accountId,
      actions: [deployGlobalContract3(code, deployMode)]
    });
  }
  /**
   * Use a previously deployed global contract on this account
   *
   * @param contractIdentifier The global contract identifier - either { accountId: string } or { codeHash: string | Uint8Array }
   */
  async useGlobalContract(contractIdentifier) {
    return this.signAndSendTransaction({
      receiverId: this.accountId,
      actions: [useGlobalContract3(contractIdentifier)]
    });
  }
  /**
   *
   * @param options
   * @param options.publicKey The key to add to the account
   * @param options.contractId The contract that this key can call
   * @param options.methodNames The methods this key is allowed to call
   * @param options.allowance The amount of NEAR this key can expend in gas
   * @returns
   */
  async addFunctionCallAccessKey({
    publicKey,
    contractId,
    methodNames = [],
    allowance = NEAR.toUnits("0.25")
  }) {
    return this.signAndSendTransaction({
      receiverId: this.accountId,
      actions: [addFunctionCallAccessKey2(PublicKey.from(publicKey), contractId, methodNames, BigInt(allowance))]
    });
  }
  /**
   * Add a full access key to the account
   *
   * @param publicKey The public key to be added
   */
  async addFullAccessKey(publicKey) {
    return this.signAndSendTransaction({
      receiverId: this.accountId,
      actions: [addFullAccessKey2(PublicKey.from(publicKey))]
    });
  }
  /**
   * Add a full access gas key to the account. Its balance starts at 0, fund it with {@link transferToGasKey}
   *
   * @param publicKey The public key to be added
   * @param numNonces The number of independent nonce lanes (1-1024, default 1)
   */
  async addFullAccessGasKey(publicKey, numNonces = 1) {
    return this.signAndSendTransaction({
      receiverId: this.accountId,
      actions: [addFullAccessGasKey2(PublicKey.from(publicKey), numNonces)]
    });
  }
  /**
   * Add a function call gas key to the account. Its balance starts at 0, fund it with {@link transferToGasKey}
   *
   * @param options
   * @param options.publicKey The key to add to the account
   * @param options.contractId The contract that this key can call
   * @param options.methodNames The methods this key is allowed to call
   * @param options.numNonces The number of independent nonce lanes (1-1024, default 1)
   */
  async addFunctionCallGasKey({
    publicKey,
    contractId,
    methodNames = [],
    numNonces = 1
  }) {
    return this.signAndSendTransaction({
      receiverId: this.accountId,
      actions: [addFunctionCallGasKey2(PublicKey.from(publicKey), contractId, methodNames, numNonces)]
    });
  }
  /**
   * Fund a gas key balance. The gas key can belong to any account
   *
   * @param accountId The account that owns the gas key
   * @param publicKey The public key of the gas key
   * @param amount The amount of yoctoNEAR to transfer to the gas key
   */
  async transferToGasKey(accountId, publicKey, amount) {
    return this.signAndSendTransaction({
      receiverId: accountId,
      actions: [transferToGasKey2(PublicKey.from(publicKey), BigInt(amount))]
    });
  }
  /**
   * Move balance from one of this account's gas keys back to the account
   *
   * @param publicKey The public key of the gas key
   * @param amount The amount of yoctoNEAR to withdraw
   */
  async withdrawFromGasKey(publicKey, amount) {
    return this.signAndSendTransaction({
      receiverId: this.accountId,
      actions: [withdrawFromGasKey2(PublicKey.from(publicKey), BigInt(amount))]
    });
  }
  /**
   * @param publicKey The public key to be deleted
   */
  async deleteKey(publicKey) {
    return this.signAndSendTransaction({
      receiverId: this.accountId,
      actions: [deleteKey3(PublicKey.from(publicKey))]
    });
  }
  /**
   * Call a function on a smart contract and return parsed transaction result
   *
   * @param params Call function parameters
   * @param params.contractId The contract in which to call the function
   * @param params.methodName The method that will be called
   * @param params.args Arguments, either as a valid JSON Object or a raw Uint8Array
   * @param params.deposit (optional) Amount of NEAR Tokens to attach to the call (default 0)
   * @param params.gas (optional) Amount of GAS to use attach to the call (default 30TGas)
   * @param params.waitUntil (optional) Transaction finality to wait for (default INCLUDED_FINAL)
   * @returns
   */
  async callFunction(params) {
    const outcome = await this.callFunctionRaw(params);
    return getTransactionLastResult(outcome);
  }
  /**
   * Call a function on a smart contract and return raw transaction outcome
   *
   * @param params Call function parameters
   * @param params.contractId The contract in which to call the function
   * @param params.methodName The method that will be called
   * @param params.args Arguments, either as a valid JSON Object or a raw Uint8Array
   * @param params.deposit (optional) Amount of NEAR Tokens to attach to the call (default 0)
   * @param params.gas (optional) Amount of GAS to use attach to the call (default 30TGas)
   * @param params.waitUntil (optional) Transaction finality to wait for (default INCLUDED_FINAL)
   */
  async callFunctionRaw({
    contractId,
    methodName,
    args = {},
    deposit = 0n,
    gas = DEFAULT_FUNCTION_CALL_GAS,
    waitUntil = DEFAULT_WAIT_STATUS
  }) {
    return await this.signAndSendTransaction({
      receiverId: contractId,
      actions: [functionCall3(methodName, args, BigInt(gas), BigInt(deposit))],
      waitUntil
    });
  }
  /**
   * This function simply calls the `signNep413Message` method of the Signer
   *
   * @deprecated This method is deprecated and will be removed in future versions. Please use `signMessage` from `near-api-js/nep413` to sign NEP-413 messages.
   *
   * @param args Nep413 message signing arguments
   * @param args.message The message to be signed (e.g. "authenticating")
   * @param args.recipient Who will receive the message (e.g. auth.app.com)
   * @param args.nonce A challenge sent by the recipient
   * @param args.callbackUrl (optional) Deprecated parameter used only by browser wallets
   * @returns
   */
  async signNep413Message({
    message,
    recipient,
    nonce,
    callbackUrl
  }) {
    if (!this.signer) throw new Error("Please set a signer");
    return this.signer.signNep413Message(this.accountId, {
      message,
      recipient,
      nonce,
      callbackUrl
    });
  }
  /**
   *
   * @param token The token to check the balance of. Defaults to Native NEAR.
   * @returns The available balance of the account in units (e.g. yoctoNEAR).
   */
  async getBalance(token = NEAR) {
    return token.getBalance(this);
  }
  /**
   * Relay a meta-transaction signed by a different account
   *
   * @param signedDelegate The signed delegate action to relay
   * @returns The transaction response from the relayed meta-transaction
   */
  async relayMetaTransaction(signedDelegate22) {
    return this.signAndSendTransaction({
      receiverId: signedDelegate22.delegateAction.senderId,
      actions: [actions.signedDelegate(signedDelegate22)]
    });
  }
  /**
   * Transfers a token to the specified receiver.
   *
   * Supports sending either the native NEAR token or any supported Fungible Token (FT).
   *
   * @param options Transfer options
   * @param options.amount - The amount of tokens to transfer in units (e.g. yoctoNEAR).
   * @param options.receiverId - The NEAR account ID of the receiver.
   * @param options.token - The token to transfer. Defaults to Native NEAR.
   *
   */
  async transfer({ receiverId, amount, token = NEAR }) {
    if (token instanceof FungibleToken) {
      const isRegistered = await token.isAccountRegistered({ accountId: receiverId, provider: this.provider });
      if (!isRegistered) {
        await token.registerAccount({
          accountIdToRegister: receiverId,
          fundingAccount: this
        });
      }
    }
    return token.transfer({ from: this, receiverId, amount });
  }
};

// src/keys.mjs
var AgentSigner = class {
  constructor(secret) {
    if (typeof secret !== "string" || !secret.startsWith("ed25519:")) {
      fail("invalid_key", "Expected ed25519 private key");
    }
    let raw;
    try {
      raw = baseDecode(secret.slice(8));
    } catch {
      fail("invalid_key", "Invalid ed25519 private key encoding");
    }
    if (raw.length !== 32 && raw.length !== 64) {
      fail("invalid_key", "Invalid ed25519 private key length");
    }
    try {
      this.keyPair = KeyPair.fromString(secret);
    } catch {
      fail("invalid_key", "Invalid ed25519 private key");
    }
    const publicKey = this.keyPair.getPublicKey();
    if (raw.length === 64 && !Buffer.from(raw.subarray(32)).equals(Buffer.from(publicKey.data))) {
      fail("invalid_key", "Secret public-key suffix does not match seed");
    }
    this.publicKey = publicKey.toString();
    this.keyPairSigner = new KeyPairSigner(this.keyPair);
  }
  async signNep413(payload) {
    const nonce = Buffer.from(payload.nonce || "", "base64");
    if (nonce.length !== 32 || nonce.toString("base64") !== payload.nonce) {
      fail("invalid_nonce", "Invalid NEP-413 nonce");
    }
    const signed = await this.keyPairSigner.signNep413Message("", {
      message: payload.message,
      recipient: payload.recipient,
      nonce
    });
    return `ed25519:${baseEncode(signed.signature)}`;
  }
};
async function loadSigner(accountId, env = process.env, home = homedir()) {
  let secret = env.NEAR_PRIVATE_KEY;
  if (!secret) {
    if (!/^[a-z0-9._-]+$/.test(accountId) || accountId.includes("..")) {
      fail("invalid_account", "Invalid NEAR account ID");
    }
    const credential = JSON.parse(await readFile2(join3(home, ".near-credentials", "mainnet", `${accountId}.json`), "utf8"));
    secret = credential.private_key || credential.secret_key;
  }
  return new AgentSigner(secret);
}

// src/rpc.mjs
import { createHash as createHash2 } from "node:crypto";

// node_modules/.pnpm/near-api-js@7.4.0/node_modules/near-api-js/lib/tokens/index.js
var NEAR_NOMINATION_EXP2 = 24;
var NEAR_NOMINATION2 = 10n ** BigInt(NEAR_NOMINATION_EXP2);
var ROUNDING_OFFSETS2 = [];
var BN102 = 10n;
for (let i = 0, offset = 5n; i < NEAR_NOMINATION_EXP2; i++, offset = offset * BN102) {
  ROUNDING_OFFSETS2[i] = offset;
}
var encoder2 = new TextEncoder();
var decoder2 = new TextDecoder();
function stringToBytes2(str) {
  return encoder2.encode(str);
}
var Enum3 = class {
  constructor(properties) {
    if (Object.keys(properties).length !== 1) {
      throw new Error("Enum can only take single value");
    }
    Object.keys(properties).forEach((key) => {
      this[key] = properties[key];
    });
  }
};
var FunctionCallPermission2 = class {
  constructor({
    allowance,
    receiverId,
    methodNames
  }) {
    this.allowance = allowance;
    this.receiverId = receiverId;
    this.methodNames = methodNames;
  }
};
var FullAccessPermission2 = class {
};
var GasKeyInfo2 = class {
  constructor({ balance, numNonces }) {
    this.balance = balance;
    this.numNonces = numNonces;
  }
};
var GasKeyFunctionCallPermission2 = class {
  constructor({ gasKeyInfo, functionCall: functionCall22 }) {
    this.gasKeyInfo = gasKeyInfo;
    this.functionCall = functionCall22;
  }
};
var AccessKeyPermission2 = class extends Enum3 {
  constructor(props) {
    super(props);
    for (const [k, v] of Object.entries(props || {})) {
      this[k] = v;
      this.enum = k;
    }
  }
};
var AccessKey2 = class {
  constructor({ nonce, permission }) {
    this.nonce = nonce;
    this.permission = permission;
  }
};
var CreateAccount2 = class {
};
var DeployContract2 = class {
  constructor({ code }) {
    this.code = code;
  }
};
var FunctionCall2 = class {
  constructor({
    methodName,
    args,
    gas,
    deposit
  }) {
    this.methodName = methodName;
    this.args = args;
    this.gas = gas;
    this.deposit = deposit;
  }
};
var GlobalContractDeployMode2 = class extends Enum3 {
  constructor(props) {
    super(props);
    for (const [k, v] of Object.entries(props || {})) {
      this[k] = v;
      this.enum = k;
    }
  }
};
var GlobalContractIdentifier2 = class extends Enum3 {
  constructor(props) {
    super(props);
    for (const [k, v] of Object.entries(props || {})) {
      this[k] = v;
      this.enum = k;
    }
  }
};
var DeployGlobalContract2 = class {
  constructor({ code, deployMode }) {
    this.code = code;
    this.deployMode = deployMode;
  }
};
var UseGlobalContract2 = class {
  constructor({ contractIdentifier }) {
    this.contractIdentifier = contractIdentifier;
  }
};
var Transfer2 = class {
  constructor({ deposit }) {
    this.deposit = deposit;
  }
};
var Stake2 = class {
  constructor({ stake: stake22, publicKey }) {
    this.stake = stake22;
    this.publicKey = publicKey;
  }
};
var AddKey2 = class {
  constructor({ publicKey, accessKey }) {
    this.publicKey = publicKey;
    this.accessKey = accessKey;
  }
};
var DeleteKey2 = class {
  constructor({ publicKey }) {
    this.publicKey = publicKey;
  }
};
var DeleteAccount2 = class {
  constructor({ beneficiaryId }) {
    this.beneficiaryId = beneficiaryId;
  }
};
var TransferToGasKey2 = class {
  constructor({ publicKey, deposit }) {
    this.publicKey = publicKey;
    this.deposit = deposit;
  }
};
var WithdrawFromGasKey2 = class {
  constructor({ publicKey, amount }) {
    this.publicKey = publicKey;
    this.amount = amount;
  }
};
var SignedDelegate2 = class {
  constructor({ delegateAction, signature }) {
    this.delegateAction = delegateAction;
    this.signature = signature;
  }
};
var Action2 = class extends Enum3 {
  constructor(props) {
    super(props);
    for (const [k, v] of Object.entries(props || {})) {
      this[k] = v;
      this.enum = k;
    }
  }
};
function fullAccessKey2() {
  return new AccessKey2({
    nonce: 0n,
    permission: new AccessKeyPermission2({
      fullAccess: new FullAccessPermission2()
    })
  });
}
function functionCallAccessKey2(receiverId, methodNames, allowance) {
  return new AccessKey2({
    nonce: 0n,
    permission: new AccessKeyPermission2({
      functionCall: new FunctionCallPermission2({
        receiverId,
        allowance,
        methodNames
      })
    })
  });
}
function fullAccessGasKey2(numNonces) {
  return new AccessKey2({
    nonce: 0n,
    permission: new AccessKeyPermission2({
      gasKeyFullAccess: new GasKeyInfo2({ balance: 0n, numNonces })
    })
  });
}
function functionCallGasKey2(receiverId, methodNames, numNonces) {
  return new AccessKey2({
    nonce: 0n,
    permission: new AccessKeyPermission2({
      gasKeyFunctionCall: new GasKeyFunctionCallPermission2({
        gasKeyInfo: new GasKeyInfo2({ balance: 0n, numNonces }),
        functionCall: new FunctionCallPermission2({ receiverId, methodNames })
      })
    })
  });
}
function createAccount4() {
  return new Action2({ createAccount: new CreateAccount2() });
}
function deployContract4(code) {
  return new Action2({ deployContract: new DeployContract2({ code }) });
}
function stringifyJsonOrBytes2(args) {
  if (args instanceof Uint8Array) return args;
  return stringToBytes2(JSON.stringify(args));
}
function functionCall4(methodName, args, gas = 0n, deposit = 0n, stringify = stringifyJsonOrBytes2) {
  return new Action2({
    functionCall: new FunctionCall2({
      methodName,
      args: stringify(args),
      gas,
      deposit
    })
  });
}
function transfer4(deposit = 0n) {
  return new Action2({ transfer: new Transfer2({ deposit }) });
}
function stake3(stake22 = 0n, publicKey) {
  return new Action2({ stake: new Stake2({ stake: stake22, publicKey }) });
}
function addKey2(publicKey, accessKey) {
  return new Action2({ addKey: new AddKey2({ publicKey, accessKey }) });
}
function addFullAccessKey3(publicKey) {
  return addKey2(publicKey, fullAccessKey2());
}
function addFunctionCallAccessKey3(publicKey, receiverId, methodNames, allowance) {
  return addKey2(publicKey, functionCallAccessKey2(receiverId, methodNames, allowance));
}
function addFullAccessGasKey3(publicKey, numNonces) {
  return addKey2(publicKey, fullAccessGasKey2(numNonces));
}
function addFunctionCallGasKey3(publicKey, receiverId, methodNames, numNonces) {
  return addKey2(publicKey, functionCallGasKey2(receiverId, methodNames, numNonces));
}
function transferToGasKey3(publicKey, deposit) {
  return new Action2({ transferToGasKey: new TransferToGasKey2({ publicKey, deposit }) });
}
function withdrawFromGasKey3(publicKey, amount) {
  return new Action2({ withdrawFromGasKey: new WithdrawFromGasKey2({ publicKey, amount }) });
}
function deleteKey4(publicKey) {
  return new Action2({ deleteKey: new DeleteKey2({ publicKey }) });
}
function deleteAccount4(beneficiaryId) {
  return new Action2({ deleteAccount: new DeleteAccount2({ beneficiaryId }) });
}
function signedDelegate2({
  delegateAction,
  signature
}) {
  return new Action2({
    signedDelegate: new SignedDelegate2({ delegateAction, signature })
  });
}
function deployGlobalContract4(code, deployMode) {
  const mode = deployMode === "codeHash" ? new GlobalContractDeployMode2({ CodeHash: null }) : new GlobalContractDeployMode2({ AccountId: null });
  return new Action2({ deployGlobalContract: new DeployGlobalContract2({ code, deployMode: mode }) });
}
function useGlobalContract4(contractIdentifier) {
  const identifier = "accountId" in contractIdentifier ? new GlobalContractIdentifier2({
    AccountId: contractIdentifier.accountId
  }) : new GlobalContractIdentifier2({
    CodeHash: typeof contractIdentifier.codeHash === "string" ? new Uint8Array(
      contractIdentifier.codeHash.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
    ) : contractIdentifier.codeHash
  });
  return new Action2({ useGlobalContract: new UseGlobalContract2({ contractIdentifier: identifier }) });
}
var actions2 = {
  addFullAccessGasKey: addFullAccessGasKey3,
  addFullAccessKey: addFullAccessKey3,
  addFunctionCallAccessKey: addFunctionCallAccessKey3,
  addFunctionCallGasKey: addFunctionCallGasKey3,
  createAccount: createAccount4,
  deleteAccount: deleteAccount4,
  deleteKey: deleteKey4,
  deployContract: deployContract4,
  fullAccessGasKey: fullAccessGasKey2,
  fullAccessKey: fullAccessKey2,
  functionCall: functionCall4,
  functionCallAccessKey: functionCallAccessKey2,
  functionCallGasKey: functionCallGasKey2,
  signedDelegate: signedDelegate2,
  stake: stake3,
  transfer: transfer4,
  deployGlobalContract: deployGlobalContract4,
  useGlobalContract: useGlobalContract4,
  transferToGasKey: transferToGasKey3,
  withdrawFromGasKey: withdrawFromGasKey3
};
function toUnits2(amount, exponent) {
  const cleanedAmount = cleanupAmount(`${amount}`);
  if (!cleanedAmount) {
    throw new Error("Amount cannot be empty");
  }
  const split2 = cleanedAmount.split(".");
  const wholePart = split2[0];
  const fracPart = split2[1] || "";
  if (split2.length > 2 || fracPart.length > exponent) {
    throw new Error(`Cannot parse '${amount}'`);
  }
  return BigInt(trimLeadingZeroes(wholePart + fracPart.padEnd(exponent, "0")));
}
function cleanupAmount(amount) {
  return amount.replace(/,/g, "").trim();
}
function trimLeadingZeroes(value) {
  value = value.replace(/^0+/, "");
  if (value === "") {
    return "0";
  }
  return value;
}
var TERA_NOMINATION_EXP2 = 12;
function teraToGas2(tera) {
  return toUnits2(tera, TERA_NOMINATION_EXP2);
}
var MAX_NOMINATION_EXP2 = 24;
function formatAmount2(units, fracDigits, precision = fracDigits) {
  units = cleanupUnits2(units);
  const wholeStr = units.substring(0, units.length - fracDigits) || "0";
  let fractionStr = units.substring(units.length - fracDigits).substring(0, fracDigits).padStart(fracDigits, "0");
  fractionStr = fractionStr.substring(0, precision);
  return trimTrailingZeroes(`${wholeStr}.${fractionStr}`);
}
function parseAmount2(amount, fracDigits) {
  amount = cleanupAmount22(amount);
  const split2 = amount.split(".");
  if (split2.length > 2) {
    throw new Error(`Cannot parse amount '${amount}' as it contains more than a single dot`);
  }
  const wholePart = split2[0];
  const fracPart = split2[1] || "";
  if (fracPart.length > MAX_NOMINATION_EXP2) {
    throw new Error(
      `Cannot parse amount '${amount}' as it exceeds maximum decimal precision of ${MAX_NOMINATION_EXP2}`
    );
  }
  return trimLeadingZeroes22(wholePart + fracPart.substring(0, fracDigits).padEnd(fracDigits, "0"));
}
function cleanupAmount22(amount) {
  return amount.replace(/,/g, ".").trim();
}
function trimTrailingZeroes(value) {
  return value.replace(/\.?0*$/, "");
}
function trimLeadingZeroes22(value) {
  value = value.replace(/^0+/, "");
  if (value === "") {
    return "0";
  }
  return value;
}
function cleanupUnits2(amount) {
  return BigInt(amount).toString();
}
var BaseFT2 = class {
  constructor(metadata) {
    this.metadata = metadata;
  }
  /**
   * Converts a decimal number to indivisible units
   *
   * @param amount The amount in decimal format (e.g. "1.234")
   * @returns The amount in indivisible units (e.g. "1234")
   */
  toUnits(amount) {
    const units = parseAmount2(amount.toString(), this.metadata.decimals);
    return BigInt(units);
  }
  /**
   * Converts indivisible units to a decimal number (represented as a string)
   *
   * @param amount The amount in indivisible units (e.g. "1234")
   * @param precision (optional) number of digits shown to the right of the decimal point - rounded down
   * @returns The amount as a decimal string (e.g. "1.234")
   */
  toDecimal(amount, precision) {
    return formatAmount2(amount, this.metadata.decimals, precision);
  }
};
var NativeToken2 = class extends BaseFT2 {
  async transfer({
    from,
    receiverId,
    amount
  }) {
    return from.signAndSendTransaction({
      receiverId,
      actions: [actions2.transfer(BigInt(amount))]
    });
  }
  async getBalance(account) {
    const {
      balance: { available }
    } = await account.getState();
    return available;
  }
};
var FungibleToken2 = class extends BaseFT2 {
  constructor(accountId, metadata) {
    metadata.spec = metadata.spec || "ft-1.0.0";
    super(metadata);
    this.accountId = accountId;
  }
  async transfer({
    from,
    receiverId,
    amount
  }) {
    return from.callFunction({
      contractId: this.accountId,
      methodName: "ft_transfer",
      args: {
        amount: amount.toString(),
        receiver_id: receiverId
      },
      gas: teraToGas2(30),
      deposit: 1
    });
  }
  async getBalance({ accountId, provider }) {
    const balance = await provider.callFunction({
      contractId: this.accountId,
      method: "ft_balance_of",
      args: { account_id: accountId }
    });
    return BigInt(balance);
  }
  /**
   * Transfer tokens and call a function on the receiver contract,
   * only works if the receiver implements the `ft_on_transfer` method
   *
   * @param param Transfer call parameters
   * @param param.from The Account that will transfer the tokens
   * @param param.receiverId The AccountID that will receive the tokens
   * @param param.amount The amount of tokens to transfer in the smallest unit
   * @param param.msg The message to send to the `ft_on_transfer` method
   */
  async transferCall({
    from,
    receiverId,
    amount,
    msg
  }) {
    return from.callFunction({
      contractId: this.accountId,
      methodName: "ft_transfer_call",
      args: {
        receiver_id: receiverId,
        amount: amount.toString(),
        msg
      },
      gas: teraToGas2(30),
      deposit: 1
    });
  }
  /**
   * Register an account to the fungible token contract by paying a storage deposit
   *
   * @param param
   * @param param.accountIdToRegister The AccountID to register
   * @param param.fundingAccount The Account that will fund the registration
   */
  async registerAccount({
    accountIdToRegister,
    fundingAccount
  }) {
    const bounds = await fundingAccount.provider.callFunction({
      contractId: this.accountId,
      method: "storage_balance_bounds",
      args: {}
    });
    const requiredDeposit = bounds.min;
    return fundingAccount.callFunction({
      contractId: this.accountId,
      methodName: "storage_deposit",
      args: {
        account_id: accountIdToRegister,
        registration_only: true
      },
      gas: teraToGas2(30),
      deposit: requiredDeposit
    });
  }
  /**
   * Unregister an account from the fungible token contract by paying a storage deposit
   *
   * @param param
   * @param param.account The Account to unregister
   * @param param.force Whether to remove the account without claiming the storage deposit
   */
  async unregisterAccount({ account, force = false }) {
    return account.callFunction({
      contractId: this.accountId,
      methodName: "storage_unregister",
      args: { force },
      gas: teraToGas2(30),
      deposit: 1
    });
  }
  /**
   * Checks if an account is registered to the fungible token contract
   *
   * @param param
   * @param param.accountId The AccountID to check
   * @param param.provider A Provider to use for the query
   * @returns Whether the account is registered
   */
  async isAccountRegistered({
    accountId,
    provider
  }) {
    const [storage, required] = await Promise.all([
      provider.callFunction({
        contractId: this.accountId,
        method: "storage_balance_of",
        args: { account_id: accountId }
      }),
      provider.callFunction({
        contractId: this.accountId,
        method: "storage_balance_bounds",
        args: {}
      })
    ]);
    if (!storage) return false;
    return BigInt(storage.total) >= BigInt(required.min);
  }
};
var NEAR2 = new NativeToken2({
  name: "NEAR",
  decimals: 24,
  symbol: "NEAR",
  icon: "data:image/svg+xml,%3Csvg%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2216%22%20fill%3D%22white%22%3E%3C%2Fcircle%3E%3Cg%20clip-path%3D%22url(%23clip0000000003)%22%3E%3Cpath%20d%3D%22M20.8422%208.84471L17.4978%2013.776C17.4501%2013.847%2017.43%2013.9328%2017.4411%2014.0174C17.4522%2014.102%2017.4938%2014.1798%2017.5582%2014.2363C17.6225%2014.2928%2017.7053%2014.3243%2017.7913%2014.3249C17.8772%2014.3254%2017.9604%2014.2951%2018.0256%2014.2395L21.3178%2011.4036C21.3371%2011.3865%2021.361%2011.3753%2021.3866%2011.3714C21.4122%2011.3675%2021.4383%2011.3711%2021.4619%2011.3818C21.4855%2011.3924%2021.5054%2011.4096%2021.5193%2011.4314C21.5331%2011.4531%2021.5403%2011.4783%2021.54%2011.504V20.3824C21.54%2020.4095%2021.5316%2020.4361%2021.5158%2020.4583C21.5001%2020.4806%2021.4779%2020.4975%2021.4522%2020.5068C21.4265%2020.516%2021.3985%2020.5172%2021.3721%2020.5102C21.3456%2020.5031%2021.322%2020.4882%2021.3044%2020.4673L11.3533%208.63726C11.1933%208.44956%2010.994%208.29873%2010.7693%208.19525C10.5446%208.09178%2010.2999%208.03815%2010.0522%208.03809H9.70444C9.2524%208.03809%208.81887%208.21642%208.49922%208.53386C8.17957%208.8513%208%209.28185%208%209.73078V22.2351C8%2022.684%208.17957%2023.1145%208.49922%2023.432C8.81887%2023.7494%209.2524%2023.9277%209.70444%2023.9277V23.9277C9.99591%2023.9278%2010.2825%2023.8537%2010.537%2023.7125C10.7914%2023.5713%2011.0051%2023.3677%2011.1578%2023.1211L14.5022%2018.1898C14.5499%2018.1188%2014.57%2018.033%2014.5589%2017.9484C14.5478%2017.8638%2014.5062%2017.7861%2014.4418%2017.7295C14.3775%2017.673%2014.2947%2017.6415%2014.2087%2017.641C14.1228%2017.6404%2014.0396%2017.6707%2013.9744%2017.7264L10.6822%2020.5622C10.6629%2020.5794%2010.639%2020.5906%2010.6134%2020.5944C10.5878%2020.5983%2010.5617%2020.5947%2010.5381%2020.5841C10.5145%2020.5734%2010.4946%2020.5562%2010.4807%2020.5345C10.4669%2020.5128%2010.4597%2020.4875%2010.46%2020.4618V11.5813C10.46%2011.5541%2010.4684%2011.5276%2010.4842%2011.5053C10.4999%2011.483%2010.5221%2011.4661%2010.5478%2011.4568C10.5735%2011.4476%2010.6015%2011.4464%2010.6279%2011.4534C10.6544%2011.4605%2010.678%2011.4755%2010.6956%2011.4963L20.6456%2023.3286C20.8056%2023.5163%2021.0049%2023.6671%2021.2296%2023.7706C21.4543%2023.874%2021.699%2023.9277%2021.9467%2023.9277H22.2944C22.5184%2023.9279%2022.7401%2023.8842%2022.947%2023.7992C23.154%2023.7142%2023.342%2023.5895%2023.5004%2023.4324C23.6588%2023.2752%2023.7844%2023.0885%2023.8702%2022.8831C23.9559%2022.6776%2024%2022.4574%2024%2022.2351V9.73078C24%209.28185%2023.8204%208.8513%2023.5008%208.53386C23.1811%208.21642%2022.7476%208.03809%2022.2956%208.03809C22.0041%208.03801%2021.7175%208.11211%2021.4631%208.25332C21.2086%208.39453%2020.9949%208.59814%2020.8422%208.84471V8.84471Z%22%20fill%3D%22black%22%3E%3C%2Fpath%3E%3C%2Fg%3E%3Cdefs%3E%3CclipPath%20id%3D%22clip00033%22%3E%3Crect%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22black%22%20transform%3D%22translate(8%207.9834)%22%3E%3C%2Frect%3E%3C%2FclipPath%3E%3C%2Fdefs%3E%3C%2Fsvg%3E"
});

// node_modules/.pnpm/near-api-js@7.4.0/node_modules/near-api-js/lib/tokens/mainnet/index.js
var NEAR_NOMINATION_EXP3 = 24;
var NEAR_NOMINATION3 = 10n ** BigInt(NEAR_NOMINATION_EXP3);
var ROUNDING_OFFSETS3 = [];
var BN103 = 10n;
for (let i = 0, offset = 5n; i < NEAR_NOMINATION_EXP3; i++, offset = offset * BN103) {
  ROUNDING_OFFSETS3[i] = offset;
}
var encoder3 = new TextEncoder();
var decoder3 = new TextDecoder();
function stringToBytes3(str) {
  return encoder3.encode(str);
}
var Enum4 = class {
  constructor(properties) {
    if (Object.keys(properties).length !== 1) {
      throw new Error("Enum can only take single value");
    }
    Object.keys(properties).forEach((key) => {
      this[key] = properties[key];
    });
  }
};
var FunctionCallPermission3 = class {
  constructor({
    allowance,
    receiverId,
    methodNames
  }) {
    this.allowance = allowance;
    this.receiverId = receiverId;
    this.methodNames = methodNames;
  }
};
var FullAccessPermission3 = class {
};
var GasKeyInfo3 = class {
  constructor({ balance, numNonces }) {
    this.balance = balance;
    this.numNonces = numNonces;
  }
};
var GasKeyFunctionCallPermission3 = class {
  constructor({ gasKeyInfo, functionCall: functionCall22 }) {
    this.gasKeyInfo = gasKeyInfo;
    this.functionCall = functionCall22;
  }
};
var AccessKeyPermission3 = class extends Enum4 {
  constructor(props) {
    super(props);
    for (const [k, v] of Object.entries(props || {})) {
      this[k] = v;
      this.enum = k;
    }
  }
};
var AccessKey3 = class {
  constructor({ nonce, permission }) {
    this.nonce = nonce;
    this.permission = permission;
  }
};
var CreateAccount3 = class {
};
var DeployContract3 = class {
  constructor({ code }) {
    this.code = code;
  }
};
var FunctionCall3 = class {
  constructor({
    methodName,
    args,
    gas,
    deposit
  }) {
    this.methodName = methodName;
    this.args = args;
    this.gas = gas;
    this.deposit = deposit;
  }
};
var GlobalContractDeployMode3 = class extends Enum4 {
  constructor(props) {
    super(props);
    for (const [k, v] of Object.entries(props || {})) {
      this[k] = v;
      this.enum = k;
    }
  }
};
var GlobalContractIdentifier3 = class extends Enum4 {
  constructor(props) {
    super(props);
    for (const [k, v] of Object.entries(props || {})) {
      this[k] = v;
      this.enum = k;
    }
  }
};
var DeployGlobalContract3 = class {
  constructor({ code, deployMode }) {
    this.code = code;
    this.deployMode = deployMode;
  }
};
var UseGlobalContract3 = class {
  constructor({ contractIdentifier }) {
    this.contractIdentifier = contractIdentifier;
  }
};
var Transfer3 = class {
  constructor({ deposit }) {
    this.deposit = deposit;
  }
};
var Stake3 = class {
  constructor({ stake: stake22, publicKey }) {
    this.stake = stake22;
    this.publicKey = publicKey;
  }
};
var AddKey3 = class {
  constructor({ publicKey, accessKey }) {
    this.publicKey = publicKey;
    this.accessKey = accessKey;
  }
};
var DeleteKey3 = class {
  constructor({ publicKey }) {
    this.publicKey = publicKey;
  }
};
var DeleteAccount3 = class {
  constructor({ beneficiaryId }) {
    this.beneficiaryId = beneficiaryId;
  }
};
var TransferToGasKey3 = class {
  constructor({ publicKey, deposit }) {
    this.publicKey = publicKey;
    this.deposit = deposit;
  }
};
var WithdrawFromGasKey3 = class {
  constructor({ publicKey, amount }) {
    this.publicKey = publicKey;
    this.amount = amount;
  }
};
var SignedDelegate3 = class {
  constructor({ delegateAction, signature }) {
    this.delegateAction = delegateAction;
    this.signature = signature;
  }
};
var Action3 = class extends Enum4 {
  constructor(props) {
    super(props);
    for (const [k, v] of Object.entries(props || {})) {
      this[k] = v;
      this.enum = k;
    }
  }
};
function fullAccessKey3() {
  return new AccessKey3({
    nonce: 0n,
    permission: new AccessKeyPermission3({
      fullAccess: new FullAccessPermission3()
    })
  });
}
function functionCallAccessKey3(receiverId, methodNames, allowance) {
  return new AccessKey3({
    nonce: 0n,
    permission: new AccessKeyPermission3({
      functionCall: new FunctionCallPermission3({
        receiverId,
        allowance,
        methodNames
      })
    })
  });
}
function fullAccessGasKey3(numNonces) {
  return new AccessKey3({
    nonce: 0n,
    permission: new AccessKeyPermission3({
      gasKeyFullAccess: new GasKeyInfo3({ balance: 0n, numNonces })
    })
  });
}
function functionCallGasKey3(receiverId, methodNames, numNonces) {
  return new AccessKey3({
    nonce: 0n,
    permission: new AccessKeyPermission3({
      gasKeyFunctionCall: new GasKeyFunctionCallPermission3({
        gasKeyInfo: new GasKeyInfo3({ balance: 0n, numNonces }),
        functionCall: new FunctionCallPermission3({ receiverId, methodNames })
      })
    })
  });
}
function createAccount5() {
  return new Action3({ createAccount: new CreateAccount3() });
}
function deployContract5(code) {
  return new Action3({ deployContract: new DeployContract3({ code }) });
}
function stringifyJsonOrBytes3(args) {
  if (args instanceof Uint8Array) return args;
  return stringToBytes3(JSON.stringify(args));
}
function functionCall5(methodName, args, gas = 0n, deposit = 0n, stringify = stringifyJsonOrBytes3) {
  return new Action3({
    functionCall: new FunctionCall3({
      methodName,
      args: stringify(args),
      gas,
      deposit
    })
  });
}
function transfer5(deposit = 0n) {
  return new Action3({ transfer: new Transfer3({ deposit }) });
}
function stake4(stake22 = 0n, publicKey) {
  return new Action3({ stake: new Stake3({ stake: stake22, publicKey }) });
}
function addKey3(publicKey, accessKey) {
  return new Action3({ addKey: new AddKey3({ publicKey, accessKey }) });
}
function addFullAccessKey4(publicKey) {
  return addKey3(publicKey, fullAccessKey3());
}
function addFunctionCallAccessKey4(publicKey, receiverId, methodNames, allowance) {
  return addKey3(publicKey, functionCallAccessKey3(receiverId, methodNames, allowance));
}
function addFullAccessGasKey4(publicKey, numNonces) {
  return addKey3(publicKey, fullAccessGasKey3(numNonces));
}
function addFunctionCallGasKey4(publicKey, receiverId, methodNames, numNonces) {
  return addKey3(publicKey, functionCallGasKey3(receiverId, methodNames, numNonces));
}
function transferToGasKey4(publicKey, deposit) {
  return new Action3({ transferToGasKey: new TransferToGasKey3({ publicKey, deposit }) });
}
function withdrawFromGasKey4(publicKey, amount) {
  return new Action3({ withdrawFromGasKey: new WithdrawFromGasKey3({ publicKey, amount }) });
}
function deleteKey5(publicKey) {
  return new Action3({ deleteKey: new DeleteKey3({ publicKey }) });
}
function deleteAccount5(beneficiaryId) {
  return new Action3({ deleteAccount: new DeleteAccount3({ beneficiaryId }) });
}
function signedDelegate3({
  delegateAction,
  signature
}) {
  return new Action3({
    signedDelegate: new SignedDelegate3({ delegateAction, signature })
  });
}
function deployGlobalContract5(code, deployMode) {
  const mode = deployMode === "codeHash" ? new GlobalContractDeployMode3({ CodeHash: null }) : new GlobalContractDeployMode3({ AccountId: null });
  return new Action3({ deployGlobalContract: new DeployGlobalContract3({ code, deployMode: mode }) });
}
function useGlobalContract5(contractIdentifier) {
  const identifier = "accountId" in contractIdentifier ? new GlobalContractIdentifier3({
    AccountId: contractIdentifier.accountId
  }) : new GlobalContractIdentifier3({
    CodeHash: typeof contractIdentifier.codeHash === "string" ? new Uint8Array(
      contractIdentifier.codeHash.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
    ) : contractIdentifier.codeHash
  });
  return new Action3({ useGlobalContract: new UseGlobalContract3({ contractIdentifier: identifier }) });
}
var actions3 = {
  addFullAccessGasKey: addFullAccessGasKey4,
  addFullAccessKey: addFullAccessKey4,
  addFunctionCallAccessKey: addFunctionCallAccessKey4,
  addFunctionCallGasKey: addFunctionCallGasKey4,
  createAccount: createAccount5,
  deleteAccount: deleteAccount5,
  deleteKey: deleteKey5,
  deployContract: deployContract5,
  fullAccessGasKey: fullAccessGasKey3,
  fullAccessKey: fullAccessKey3,
  functionCall: functionCall5,
  functionCallAccessKey: functionCallAccessKey3,
  functionCallGasKey: functionCallGasKey3,
  signedDelegate: signedDelegate3,
  stake: stake4,
  transfer: transfer5,
  deployGlobalContract: deployGlobalContract5,
  useGlobalContract: useGlobalContract5,
  transferToGasKey: transferToGasKey4,
  withdrawFromGasKey: withdrawFromGasKey4
};
function toUnits3(amount, exponent) {
  const cleanedAmount = cleanupAmount4(`${amount}`);
  if (!cleanedAmount) {
    throw new Error("Amount cannot be empty");
  }
  const split2 = cleanedAmount.split(".");
  const wholePart = split2[0];
  const fracPart = split2[1] || "";
  if (split2.length > 2 || fracPart.length > exponent) {
    throw new Error(`Cannot parse '${amount}'`);
  }
  return BigInt(trimLeadingZeroes4(wholePart + fracPart.padEnd(exponent, "0")));
}
function cleanupAmount4(amount) {
  return amount.replace(/,/g, "").trim();
}
function trimLeadingZeroes4(value) {
  value = value.replace(/^0+/, "");
  if (value === "") {
    return "0";
  }
  return value;
}
var TERA_NOMINATION_EXP3 = 12;
function teraToGas3(tera) {
  return toUnits3(tera, TERA_NOMINATION_EXP3);
}
var MAX_NOMINATION_EXP3 = 24;
function formatAmount3(units, fracDigits, precision = fracDigits) {
  units = cleanupUnits3(units);
  const wholeStr = units.substring(0, units.length - fracDigits) || "0";
  let fractionStr = units.substring(units.length - fracDigits).substring(0, fracDigits).padStart(fracDigits, "0");
  fractionStr = fractionStr.substring(0, precision);
  return trimTrailingZeroes3(`${wholeStr}.${fractionStr}`);
}
function parseAmount3(amount, fracDigits) {
  amount = cleanupAmount23(amount);
  const split2 = amount.split(".");
  if (split2.length > 2) {
    throw new Error(`Cannot parse amount '${amount}' as it contains more than a single dot`);
  }
  const wholePart = split2[0];
  const fracPart = split2[1] || "";
  if (fracPart.length > MAX_NOMINATION_EXP3) {
    throw new Error(
      `Cannot parse amount '${amount}' as it exceeds maximum decimal precision of ${MAX_NOMINATION_EXP3}`
    );
  }
  return trimLeadingZeroes23(wholePart + fracPart.substring(0, fracDigits).padEnd(fracDigits, "0"));
}
function cleanupAmount23(amount) {
  return amount.replace(/,/g, ".").trim();
}
function trimTrailingZeroes3(value) {
  return value.replace(/\.?0*$/, "");
}
function trimLeadingZeroes23(value) {
  value = value.replace(/^0+/, "");
  if (value === "") {
    return "0";
  }
  return value;
}
function cleanupUnits3(amount) {
  return BigInt(amount).toString();
}
var BaseFT3 = class {
  constructor(metadata) {
    this.metadata = metadata;
  }
  /**
   * Converts a decimal number to indivisible units
   *
   * @param amount The amount in decimal format (e.g. "1.234")
   * @returns The amount in indivisible units (e.g. "1234")
   */
  toUnits(amount) {
    const units = parseAmount3(amount.toString(), this.metadata.decimals);
    return BigInt(units);
  }
  /**
   * Converts indivisible units to a decimal number (represented as a string)
   *
   * @param amount The amount in indivisible units (e.g. "1234")
   * @param precision (optional) number of digits shown to the right of the decimal point - rounded down
   * @returns The amount as a decimal string (e.g. "1.234")
   */
  toDecimal(amount, precision) {
    return formatAmount3(amount, this.metadata.decimals, precision);
  }
};
var NativeToken3 = class extends BaseFT3 {
  async transfer({
    from,
    receiverId,
    amount
  }) {
    return from.signAndSendTransaction({
      receiverId,
      actions: [actions3.transfer(BigInt(amount))]
    });
  }
  async getBalance(account) {
    const {
      balance: { available }
    } = await account.getState();
    return available;
  }
};
var FungibleToken3 = class extends BaseFT3 {
  constructor(accountId, metadata) {
    metadata.spec = metadata.spec || "ft-1.0.0";
    super(metadata);
    this.accountId = accountId;
  }
  async transfer({
    from,
    receiverId,
    amount
  }) {
    return from.callFunction({
      contractId: this.accountId,
      methodName: "ft_transfer",
      args: {
        amount: amount.toString(),
        receiver_id: receiverId
      },
      gas: teraToGas3(30),
      deposit: 1
    });
  }
  async getBalance({ accountId, provider }) {
    const balance = await provider.callFunction({
      contractId: this.accountId,
      method: "ft_balance_of",
      args: { account_id: accountId }
    });
    return BigInt(balance);
  }
  /**
   * Transfer tokens and call a function on the receiver contract,
   * only works if the receiver implements the `ft_on_transfer` method
   *
   * @param param Transfer call parameters
   * @param param.from The Account that will transfer the tokens
   * @param param.receiverId The AccountID that will receive the tokens
   * @param param.amount The amount of tokens to transfer in the smallest unit
   * @param param.msg The message to send to the `ft_on_transfer` method
   */
  async transferCall({
    from,
    receiverId,
    amount,
    msg
  }) {
    return from.callFunction({
      contractId: this.accountId,
      methodName: "ft_transfer_call",
      args: {
        receiver_id: receiverId,
        amount: amount.toString(),
        msg
      },
      gas: teraToGas3(30),
      deposit: 1
    });
  }
  /**
   * Register an account to the fungible token contract by paying a storage deposit
   *
   * @param param
   * @param param.accountIdToRegister The AccountID to register
   * @param param.fundingAccount The Account that will fund the registration
   */
  async registerAccount({
    accountIdToRegister,
    fundingAccount
  }) {
    const bounds = await fundingAccount.provider.callFunction({
      contractId: this.accountId,
      method: "storage_balance_bounds",
      args: {}
    });
    const requiredDeposit = bounds.min;
    return fundingAccount.callFunction({
      contractId: this.accountId,
      methodName: "storage_deposit",
      args: {
        account_id: accountIdToRegister,
        registration_only: true
      },
      gas: teraToGas3(30),
      deposit: requiredDeposit
    });
  }
  /**
   * Unregister an account from the fungible token contract by paying a storage deposit
   *
   * @param param
   * @param param.account The Account to unregister
   * @param param.force Whether to remove the account without claiming the storage deposit
   */
  async unregisterAccount({ account, force = false }) {
    return account.callFunction({
      contractId: this.accountId,
      methodName: "storage_unregister",
      args: { force },
      gas: teraToGas3(30),
      deposit: 1
    });
  }
  /**
   * Checks if an account is registered to the fungible token contract
   *
   * @param param
   * @param param.accountId The AccountID to check
   * @param param.provider A Provider to use for the query
   * @returns Whether the account is registered
   */
  async isAccountRegistered({
    accountId,
    provider
  }) {
    const [storage, required] = await Promise.all([
      provider.callFunction({
        contractId: this.accountId,
        method: "storage_balance_of",
        args: { account_id: accountId }
      }),
      provider.callFunction({
        contractId: this.accountId,
        method: "storage_balance_bounds",
        args: {}
      })
    ]);
    if (!storage) return false;
    return BigInt(storage.total) >= BigInt(required.min);
  }
};
var NEAR3 = new NativeToken3({
  name: "NEAR",
  decimals: 24,
  symbol: "NEAR",
  icon: "data:image/svg+xml,%3Csvg%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2216%22%20fill%3D%22white%22%3E%3C%2Fcircle%3E%3Cg%20clip-path%3D%22url(%23clip0000000003)%22%3E%3Cpath%20d%3D%22M20.8422%208.84471L17.4978%2013.776C17.4501%2013.847%2017.43%2013.9328%2017.4411%2014.0174C17.4522%2014.102%2017.4938%2014.1798%2017.5582%2014.2363C17.6225%2014.2928%2017.7053%2014.3243%2017.7913%2014.3249C17.8772%2014.3254%2017.9604%2014.2951%2018.0256%2014.2395L21.3178%2011.4036C21.3371%2011.3865%2021.361%2011.3753%2021.3866%2011.3714C21.4122%2011.3675%2021.4383%2011.3711%2021.4619%2011.3818C21.4855%2011.3924%2021.5054%2011.4096%2021.5193%2011.4314C21.5331%2011.4531%2021.5403%2011.4783%2021.54%2011.504V20.3824C21.54%2020.4095%2021.5316%2020.4361%2021.5158%2020.4583C21.5001%2020.4806%2021.4779%2020.4975%2021.4522%2020.5068C21.4265%2020.516%2021.3985%2020.5172%2021.3721%2020.5102C21.3456%2020.5031%2021.322%2020.4882%2021.3044%2020.4673L11.3533%208.63726C11.1933%208.44956%2010.994%208.29873%2010.7693%208.19525C10.5446%208.09178%2010.2999%208.03815%2010.0522%208.03809H9.70444C9.2524%208.03809%208.81887%208.21642%208.49922%208.53386C8.17957%208.8513%208%209.28185%208%209.73078V22.2351C8%2022.684%208.17957%2023.1145%208.49922%2023.432C8.81887%2023.7494%209.2524%2023.9277%209.70444%2023.9277V23.9277C9.99591%2023.9278%2010.2825%2023.8537%2010.537%2023.7125C10.7914%2023.5713%2011.0051%2023.3677%2011.1578%2023.1211L14.5022%2018.1898C14.5499%2018.1188%2014.57%2018.033%2014.5589%2017.9484C14.5478%2017.8638%2014.5062%2017.7861%2014.4418%2017.7295C14.3775%2017.673%2014.2947%2017.6415%2014.2087%2017.641C14.1228%2017.6404%2014.0396%2017.6707%2013.9744%2017.7264L10.6822%2020.5622C10.6629%2020.5794%2010.639%2020.5906%2010.6134%2020.5944C10.5878%2020.5983%2010.5617%2020.5947%2010.5381%2020.5841C10.5145%2020.5734%2010.4946%2020.5562%2010.4807%2020.5345C10.4669%2020.5128%2010.4597%2020.4875%2010.46%2020.4618V11.5813C10.46%2011.5541%2010.4684%2011.5276%2010.4842%2011.5053C10.4999%2011.483%2010.5221%2011.4661%2010.5478%2011.4568C10.5735%2011.4476%2010.6015%2011.4464%2010.6279%2011.4534C10.6544%2011.4605%2010.678%2011.4755%2010.6956%2011.4963L20.6456%2023.3286C20.8056%2023.5163%2021.0049%2023.6671%2021.2296%2023.7706C21.4543%2023.874%2021.699%2023.9277%2021.9467%2023.9277H22.2944C22.5184%2023.9279%2022.7401%2023.8842%2022.947%2023.7992C23.154%2023.7142%2023.342%2023.5895%2023.5004%2023.4324C23.6588%2023.2752%2023.7844%2023.0885%2023.8702%2022.8831C23.9559%2022.6776%2024%2022.4574%2024%2022.2351V9.73078C24%209.28185%2023.8204%208.8513%2023.5008%208.53386C23.1811%208.21642%2022.7476%208.03809%2022.2956%208.03809C22.0041%208.03801%2021.7175%208.11211%2021.4631%208.25332C21.2086%208.39453%2020.9949%208.59814%2020.8422%208.84471V8.84471Z%22%20fill%3D%22black%22%3E%3C%2Fpath%3E%3C%2Fg%3E%3Cdefs%3E%3CclipPath%20id%3D%22clip00033%22%3E%3Crect%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22black%22%20transform%3D%22translate(8%207.9834)%22%3E%3C%2Frect%3E%3C%2FclipPath%3E%3C%2Fdefs%3E%3C%2Fsvg%3E"
});
var wNEAR = new FungibleToken3("wrap.near", {
  name: "Wrapped NEAR fungible token",
  decimals: 24,
  symbol: "wNEAR",
  icon: "data:image/svg+xml,%3Csvg%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2216%22%20fill%3D%22white%22%3E%3C%2Fcircle%3E%3Cg%20clip-path%3D%22url(%23clip0000000003)%22%3E%3Cpath%20d%3D%22M20.8422%208.84471L17.4978%2013.776C17.4501%2013.847%2017.43%2013.9328%2017.4411%2014.0174C17.4522%2014.102%2017.4938%2014.1798%2017.5582%2014.2363C17.6225%2014.2928%2017.7053%2014.3243%2017.7913%2014.3249C17.8772%2014.3254%2017.9604%2014.2951%2018.0256%2014.2395L21.3178%2011.4036C21.3371%2011.3865%2021.361%2011.3753%2021.3866%2011.3714C21.4122%2011.3675%2021.4383%2011.3711%2021.4619%2011.3818C21.4855%2011.3924%2021.5054%2011.4096%2021.5193%2011.4314C21.5331%2011.4531%2021.5403%2011.4783%2021.54%2011.504V20.3824C21.54%2020.4095%2021.5316%2020.4361%2021.5158%2020.4583C21.5001%2020.4806%2021.4779%2020.4975%2021.4522%2020.5068C21.4265%2020.516%2021.3985%2020.5172%2021.3721%2020.5102C21.3456%2020.5031%2021.322%2020.4882%2021.3044%2020.4673L11.3533%208.63726C11.1933%208.44956%2010.994%208.29873%2010.7693%208.19525C10.5446%208.09178%2010.2999%208.03815%2010.0522%208.03809H9.70444C9.2524%208.03809%208.81887%208.21642%208.49922%208.53386C8.17957%208.8513%208%209.28185%208%209.73078V22.2351C8%2022.684%208.17957%2023.1145%208.49922%2023.432C8.81887%2023.7494%209.2524%2023.9277%209.70444%2023.9277V23.9277C9.99591%2023.9278%2010.2825%2023.8537%2010.537%2023.7125C10.7914%2023.5713%2011.0051%2023.3677%2011.1578%2023.1211L14.5022%2018.1898C14.5499%2018.1188%2014.57%2018.033%2014.5589%2017.9484C14.5478%2017.8638%2014.5062%2017.7861%2014.4418%2017.7295C14.3775%2017.673%2014.2947%2017.6415%2014.2087%2017.641C14.1228%2017.6404%2014.0396%2017.6707%2013.9744%2017.7264L10.6822%2020.5622C10.6629%2020.5794%2010.639%2020.5906%2010.6134%2020.5944C10.5878%2020.5983%2010.5617%2020.5947%2010.5381%2020.5841C10.5145%2020.5734%2010.4946%2020.5562%2010.4807%2020.5345C10.4669%2020.5128%2010.4597%2020.4875%2010.46%2020.4618V11.5813C10.46%2011.5541%2010.4684%2011.5276%2010.4842%2011.5053C10.4999%2011.483%2010.5221%2011.4661%2010.5478%2011.4568C10.5735%2011.4476%2010.6015%2011.4464%2010.6279%2011.4534C10.6544%2011.4605%2010.678%2011.4755%2010.6956%2011.4963L20.6456%2023.3286C20.8056%2023.5163%2021.0049%2023.6671%2021.2296%2023.7706C21.4543%2023.874%2021.699%2023.9277%2021.9467%2023.9277H22.2944C22.5184%2023.9279%2022.7401%2023.8842%2022.947%2023.7992C23.154%2023.7142%2023.342%2023.5895%2023.5004%2023.4324C23.6588%2023.2752%2023.7844%2023.0885%2023.8702%2022.8831C23.9559%2022.6776%2024%2022.4574%2024%2022.2351V9.73078C24%209.28185%2023.8204%208.8513%2023.5008%208.53386C23.1811%208.21642%2022.7476%208.03809%2022.2956%208.03809C22.0041%208.03801%2021.7175%208.11211%2021.4631%208.25332C21.2086%208.39453%2020.9949%208.59814%2020.8422%208.84471V8.84471Z%22%20fill%3D%22black%22%3E%3C%2Fpath%3E%3C%2Fg%3E%3Cdefs%3E%3CclipPath%20id%3D%22clip00033%22%3E%3Crect%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22black%22%20transform%3D%22translate(8%207.9834)%22%3E%3C%2Frect%3E%3C%2FclipPath%3E%3C%2Fdefs%3E%3C%2Fsvg%3E"
});
var USDC = new FungibleToken3("17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", {
  name: "USDC",
  decimals: 6,
  symbol: "USDC",
  icon: "data:image/svg+xml,%3C%3Fxml version=%221.0%22 encoding=%22utf-8%22%3F%3E%3C!-- Generator: Adobe Illustrator 22.0.1, SVG Export Plug-In . SVG Version: 6.00 Build 0) --%3E%3Csvg version=%221.1%22 id=%22Layer_1%22 xmlns=%22http://www.w3.org/2000/svg%22 xmlns:xlink=%22http://www.w3.org/1999/xlink%22 x=%220px%22 y=%220px%22 viewBox=%220 0 256 256%22 style=%22enable-background:new 0 0 256 256;%22 xml:space=%22preserve%22%3E%3Cstyle type=%22text/css%22%3E .st0%7Bfill:%232775CA;%7D .st1%7Bfill:%23FFFFFF;%7D%0A%3C/style%3E%3Ccircle class=%22st0%22 cx=%22128%22 cy=%22128%22 r=%22128%22/%3E%3Cpath class=%22st1%22 d=%22M104,217c0,3-2.4,4.7-5.2,3.8C60,208.4,32,172.2,32,129.3c0-42.8,28-79.1,66.8-91.5c2.9-0.9,5.2,0.8,5.2,3.8 v7.5c0,2-1.5,4.3-3.4,5C69.9,65.4,48,94.9,48,129.3c0,34.5,21.9,63.9,52.6,75.1c1.9,0.7,3.4,3,3.4,5V217z%22/%3E%3Cpath class=%22st1%22 d=%22M136,189.3c0,2.2-1.8,4-4,4h-8c-2.2,0-4-1.8-4-4v-12.6c-17.5-2.4-26-12.1-28.3-25.5c-0.4-2.3,1.4-4.3,3.7-4.3 h9.1c1.9,0,3.5,1.4,3.9,3.2c1.7,7.9,6.3,14,20.3,14c10.3,0,17.7-5.8,17.7-14.4c0-8.6-4.3-11.9-19.5-14.4c-22.4-3-33-9.8-33-27.3 c0-13.5,10.3-24.1,26.1-26.3V69.3c0-2.2,1.8-4,4-4h8c2.2,0,4,1.8,4,4v12.7c12.9,2.3,21.1,9.6,23.8,21.8c0.5,2.3-1.3,4.4-3.7,4.4 h-8.4c-1.8,0-3.3-1.2-3.8-2.9c-2.3-7.7-7.8-11.1-17.4-11.1c-10.6,0-16.1,5.1-16.1,12.3c0,7.6,3.1,11.4,19.4,13.7 c22,3,33.4,9.3,33.4,28c0,14.2-10.6,25.7-27.1,28.3V189.3z%22/%3E%3Cpath class=%22st1%22 d=%22M157.2,220.8c-2.9,0.9-5.2-0.8-5.2-3.8v-7.5c0-2.2,1.3-4.3,3.4-5c30.6-11.2,52.6-40.7,52.6-75.1 c0-34.5-21.9-63.9-52.6-75.1c-1.9-0.7-3.4-3-3.4-5v-7.5c0-3,2.4-4.7,5.2-3.8C196,50.2,224,86.5,224,129.3 C224,172.2,196,208.4,157.2,220.8z%22/%3E%3C/svg%3E%0A"
});
var USDT = new FungibleToken3("usdt.tether-token.near", {
  name: "Tether USD",
  decimals: 6,
  symbol: "USDt",
  icon: "data:image/svg+xml,%3Csvg width='111' height='90' viewBox='0 0 111 90' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M24.4825 0.862305H88.0496C89.5663 0.862305 90.9675 1.64827 91.7239 2.92338L110.244 34.1419C111.204 35.7609 110.919 37.8043 109.549 39.1171L58.5729 87.9703C56.9216 89.5528 54.2652 89.5528 52.6139 87.9703L1.70699 39.1831C0.305262 37.8398 0.0427812 35.7367 1.07354 34.1077L20.8696 2.82322C21.6406 1.60483 23.0087 0.862305 24.4825 0.862305ZM79.8419 14.8003V23.5597H61.7343V29.6329C74.4518 30.2819 83.9934 32.9475 84.0642 36.1425L84.0638 42.803C83.993 45.998 74.4518 48.6635 61.7343 49.3125V64.2168H49.7105V49.3125C36.9929 48.6635 27.4513 45.998 27.3805 42.803L27.381 36.1425C27.4517 32.9475 36.9929 30.2819 49.7105 29.6329V23.5597H31.6028V14.8003H79.8419ZM55.7224 44.7367C69.2943 44.7367 80.6382 42.4827 83.4143 39.4727C81.0601 36.9202 72.5448 34.9114 61.7343 34.3597V40.7183C59.7966 40.8172 57.7852 40.8693 55.7224 40.8693C53.6595 40.8693 51.6481 40.8172 49.7105 40.7183V34.3597C38.8999 34.9114 30.3846 36.9202 28.0304 39.4727C30.8066 42.4827 42.1504 44.7367 55.7224 44.7367Z' fill='%23009393'/%3E%3C/svg%3E"
});

// src/rpc.mjs
var DEFAULT_RPC_URLS = [
  "https://free.rpc.fastnear.com",
  "https://rpc.intea.rs",
  "https://rpc.shitzuapes.xyz",
  "https://archival-rpc.mainnet.near.org"
];
function parseRpcUrls(value) {
  if (value === void 0 || value === "") return [...DEFAULT_RPC_URLS];
  const urls = value.split(",").map((part) => part.trim());
  if (!urls.length || urls.some((part) => !part || !/^https?:\/\//.test(part))) {
    fail("invalid_config", "Invalid NEAR_RPC_URLS");
  }
  return urls;
}
function isTransientRpcError(error) {
  const details = JSON.stringify(error).toLowerCase();
  return /timeout|timed.out|internal|server.error|unavailable|too.many.requests|temporar|429|502|503|504/.test(details);
}
function rpcProblem(problem) {
  const message = typeof problem?.message === "string" ? problem.message : "JSON-RPC error";
  const error = new AgentError("rpc_error", `NEAR RPC: ${message}`);
  error.transient = isTransientRpcError(problem);
  error.unsupported = /method not found|unknown method/i.test(JSON.stringify(problem));
  return error;
}
var TimedJsonRpcProvider = class extends JsonRpcProvider {
  constructor(url, fetchImpl, timeoutMs) {
    super({ url, headers: { "User-Agent": USER_AGENT } }, { retries: 0, wait: 0, backoff: 1 });
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }
  async sendJsonRpc(method, params) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let response;
      try {
        response = await this.fetchImpl(this.connection.url, {
          method: "POST",
          signal: controller.signal,
          headers: { ...this.connection.headers, "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: "fulfil-agent", method, params })
        });
      } catch {
        const error = new AgentError(controller.signal.aborted ? "rpc_timeout" : "rpc_network", "NEAR RPC request failed");
        error.transient = true;
        throw error;
      }
      if (!response.ok) {
        const error = new AgentError(`rpc_http_${response.status}`, `NEAR RPC HTTP ${response.status}`);
        error.transient = response.status === 429 || response.status === 408 || response.status >= 500;
        throw error;
      }
      let payload;
      try {
        payload = await response.json();
      } catch {
        const code = controller.signal.aborted ? "rpc_timeout" : "rpc_response";
        const error = new AgentError(code, "Invalid or timed-out NEAR RPC response");
        error.transient = true;
        throw error;
      }
      if (payload.error) throw rpcProblem(payload.error);
      if (payload.result === void 0) {
        const error = new AgentError("rpc_response", "NEAR RPC omitted result");
        error.transient = true;
        throw error;
      }
      return payload.result;
    } finally {
      clearTimeout(timeout);
    }
  }
};
var NearRpc = class {
  constructor({ urls = DEFAULT_RPC_URLS, fetchImpl = fetch, timeoutMs = 12e3 } = {}) {
    this.urls = urls;
    this.providers = urls.map((url) => new TimedJsonRpcProvider(url, fetchImpl, timeoutMs));
    this.cursor = 0;
    this.tokens = /* @__PURE__ */ new Map([[USDC_CONTRACT, USDC]]);
  }
  async withProvider(operation) {
    let lastError;
    for (let attempt = 0; attempt < this.providers.length; attempt++) {
      const index = (this.cursor + attempt) % this.providers.length;
      try {
        const result = await operation(this.providers[index]);
        this.cursor = index;
        return result;
      } catch (error) {
        if (!error?.transient) throw error;
        lastError = error;
      }
    }
    throw new AgentError("rpc_unavailable", `All NEAR RPC endpoints failed: ${lastError?.code || "network error"}`);
  }
  async call(method, params) {
    return this.withProvider((provider) => provider.sendJsonRpc(method, params));
  }
  async callFunction(params) {
    return this.withProvider((provider) => provider.callFunction({
      ...params,
      blockQuery: { finality: "final" }
    }));
  }
  async view(contract, method, args) {
    return this.callFunction({ contractId: contract, method, args });
  }
  async viewAccessKey(params) {
    return this.withProvider((provider) => provider.viewAccessKey({
      ...params,
      finalityQuery: { finality: "final" }
    }));
  }
  async viewBlock(query) {
    return this.withProvider((provider) => provider.viewBlock(query));
  }
  async viewAccount(accountId) {
    return this.call("query", { request_type: "view_account", finality: "final", account_id: accountId });
  }
  async sendTransactionUntil(signedTransaction, waitUntil) {
    return this.withProvider(async (provider) => {
      try {
        return await provider.sendTransactionUntil(signedTransaction, waitUntil);
      } catch (error) {
        if (!error?.unsupported) throw error;
        const bytes = encodeTransaction(signedTransaction);
        return provider.sendJsonRpc("broadcast_tx_commit", [base64Encode(bytes)]);
      }
    });
  }
  async token(contract) {
    const cached = this.tokens.get(contract);
    if (cached) return cached;
    const metadata = await this.view(contract, "ft_metadata", {});
    if (!metadata || !Number.isSafeInteger(metadata.decimals) || metadata.decimals < 0 || metadata.decimals > 255) {
      fail("invalid_token", "Invalid NEP-141 token metadata");
    }
    const token = new FungibleToken2(contract, metadata);
    this.tokens.set(contract, token);
    return token;
  }
  async tokenBalance(contract, accountId) {
    const token = await this.token(contract);
    return token.getBalance({ accountId, provider: this });
  }
  async sendActions({ accountId, signer, receiverId, actions: requestedActions }) {
    const key = await this.viewAccessKey({ accountId, publicKey: signer.publicKey });
    if (key.permission !== "FullAccess") {
      fail("restricted_key", "NEAR key requires FullAccess permission");
    }
    const nativeActions = requestedActions.map((action) => {
      if (action.type === "FunctionCall") {
        return actions.functionCall(
          action.methodName,
          Buffer.from(action.args),
          decimal(action.gas, "gas", (1n << 64n) - 1n),
          decimal(action.deposit, "deposit")
        );
      }
      if (action.type === "Transfer") {
        return actions.transfer(decimal(action.deposit, "deposit"));
      }
      fail("unsupported_action", "Only FunctionCall and Transfer are supported");
    });
    const account = new Account(accountId, this, signer.keyPairSigner);
    const signed = await account.createSignedTransaction({ receiverId, actions: nativeActions });
    const hash = baseEncode(createHash2("sha256").update(encodeTransaction(signed.transaction)).digest());
    const result = await this.sendTransactionUntil(signed, "FINAL");
    if (!result?.status || result.status.Failure || !(result.status.SuccessValue !== void 0 || result.status.SuccessReceiptId !== void 0)) {
      fail("transaction_failed", `NEAR transaction did not succeed: ${hash}`);
    }
    return { tx_hash: result.transaction?.hash || hash, result };
  }
};

// src/cli.mjs
var USAGE = "node fulfil-agent.mjs <setup|orders|quote|claim|buy|deliver|prove|status|release|run|balances|withdraw> [args] [--amount <base units>|--all] [--dry-run] [--json]";
function parseArgs(argv) {
  let amount;
  const normalized = [];
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--amount") {
      amount = argv[++index];
      if (!amount) fail("usage", "--amount requires a base-unit integer");
    } else if (argv[index].startsWith("--amount=")) {
      amount = argv[index].slice(9);
    } else {
      normalized.push(argv[index]);
    }
  }
  const flags = new Set(normalized.filter((arg) => arg.startsWith("--")));
  if ([...flags].some((flag) => !["--dry-run", "--json", "--help", "--all"].includes(flag))) fail("usage", USAGE);
  const args = normalized.filter((arg) => !arg.startsWith("--"));
  return {
    command: args[0] || "help",
    params: args.slice(1),
    amount,
    all: flags.has("--all"),
    dryRun: flags.has("--dry-run"),
    help: flags.has("--help")
  };
}
async function main(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const { command, params, amount, all, dryRun, help } = parseArgs(argv);
  if (help || command === "help") return { ok: true, usage: USAGE, node: ">=20", commands: ["setup", "orders", "quote", "claim", "buy", "deliver", "prove", "status", "release", "run", "balances", "withdraw"] };
  if (!env.NEAR_ACCOUNT_ID) fail("missing_account", "NEAR_ACCOUNT_ID is required");
  const expectedArgs = { setup: 0, orders: 0, quote: 1, claim: 1, buy: 1, deliver: 1, prove: 2, status: 1, release: 1, run: 0, balances: 0, withdraw: 0 };
  if (!(command in expectedArgs) || params.length !== expectedArgs[command] || amount !== void 0 && !["deliver", "withdraw"].includes(command) || all && command !== "withdraw" || all && amount !== void 0) fail("usage", USAGE);
  if (dryRun && !["setup", "run", "orders", "quote", "status", "balances", "withdraw"].includes(command)) fail("usage", "--dry-run is supported for setup, run, withdraw and read-only commands");
  const minProfit = decimal(env.FULFIL_MIN_PROFIT_USDC || "0", "FULFIL_MIN_PROFIT_USDC").toString();
  const margin = Number(env.FULFIL_DEADLINE_MARGIN_SECONDS || "120");
  if (!Number.isSafeInteger(margin) || margin < 0) fail("invalid_config", "Invalid deadline margin");
  const signer = await (deps.loadSigner || loadSigner)(env.NEAR_ACCOUNT_ID, env, deps.home || homedir2());
  const api = deps.api || new FulfilApi({
    baseUrl: env.FULFIL_API || "https://fulfil.junstudio.xyz",
    accountId: env.NEAR_ACCOUNT_ID,
    signer,
    fetchImpl: deps.fetchImpl || fetch,
    escrowContract: env.FULFIL_ESCROW_CONTRACT || "nearfullfil.near"
  });
  if (api.loadCookie) await api.loadCookie();
  const rpc = deps.rpc || new NearRpc({ urls: parseRpcUrls(env.NEAR_RPC_URLS), fetchImpl: deps.fetchImpl || fetch });
  const router = deps.router || new IntearRouter({
    fetchImpl: deps.fetchImpl || fetch,
    slippage: env.FULFIL_SLIPPAGE || "0.03"
  });
  const commands = deps.commands || new Commands({
    accountId: env.NEAR_ACCOUNT_ID,
    signer,
    api,
    rpc,
    router,
    escrowContract: env.FULFIL_ESCROW_CONTRACT || "nearfullfil.near",
    minProfit,
    deadlineMarginSeconds: margin
  });
  const operations = {
    setup: () => commands.setup(dryRun),
    orders: () => commands.orders(),
    quote: () => commands.quote(params[0]),
    claim: () => commands.claim(params[0]),
    buy: () => commands.buy(params[0]),
    deliver: () => commands.deliver(params[0], amount),
    prove: () => commands.prove(params[0], params[1]),
    status: () => commands.status(params[0]),
    release: () => commands.release(params[0]),
    run: () => commands.run(dryRun),
    balances: () => commands.balances(),
    withdraw: () => commands.withdrawToWallet(amount ?? null, dryRun)
  };
  return { ok: true, ...await operations[command]() };
}
async function runCli(argv = process.argv.slice(2), env = process.env, write = (line) => process.stdout.write(line), deps = {}) {
  const stdoutWrite = process.stdout.write;
  const stderrWrite = process.stderr.write;
  process.stdout.write = () => true;
  process.stderr.write = () => true;
  let result;
  let exitCode = 0;
  try {
    result = await main(argv, env, deps);
  } catch (error) {
    const code = error instanceof AgentError ? error.code : "unexpected_error";
    const message = error instanceof AgentError ? error.message : "Unexpected failure; check configuration and connectivity";
    const http_status = error instanceof AgentError ? error.http_status : void 0;
    result = { ok: false, error: { code, message, ...http_status ? { http_status } : {} } };
    exitCode = 1;
  } finally {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
  }
  write(`${JSON.stringify(result)}
`);
  return exitCode;
}
var isMain = false;
try {
  isMain = Boolean(process.argv[1]) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
} catch {
}
if (isMain) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
export {
  main,
  parseArgs,
  runCli
};
