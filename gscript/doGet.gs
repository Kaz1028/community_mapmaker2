  function doGet(e) {

    // シート取得&データ入力
    var ss = SpreadsheetApp.openById(SpreadsheetApp.getActiveSpreadsheet().getId());
    var sheet, idsheet;
    var jsonSt = e.parameter.json || "";
    var modeSt = e.parameter.mode || "";
    var userid = e.parameter.userid || "";
    var passwd = e.parameter.passwd || "";
    var params = {};
    var retdata = "", userrow = 0;
    var nowdt = new Date();

    sheet = ss.getSheetByName("activity");
    idsheet = ss.getSheetByName("user");
    if (jsonSt !== "") params = JSON.parse(jsonSt);
    if (userid !== "") userrow = findRow(idsheet, userid, 1);
    Logger.log("jsonp: " + jsonSt);
    Logger.log("userid: rownum: " + userrow);

    // 引数がある場合はデータを更新
    if (userid !== "" && passwd == "") {  // useridはあるがpasswdが無い場合(json無視)
      // ソルトを計算して返す処理
      var ramdomstr = makeSalt();
      if (userrow > 0) {
        idsheet.getRange(userrow, 3).setValue(ramdomstr);
        retdata = JSON.stringify({ status: 'ok', salt: ramdomstr });
      } else {
        retdata = JSON.stringify({ status: 'ng(no user)' });
      }

    } else if (Object.keys(params).length > 0) {        // jsonがある場合はデータ更新
      // ユーザー認証
      var mtpass = idsheet.getRange(userrow, 2).getValue();
      var mtsalt = idsheet.getRange(userrow, 3).getValue();
      var digest = makeSHA256(mtpass + mtsalt);
      if (digest == passwd && userrow > 0) {
        var rows = sheet.getDataRange().getValues();
        var keys = rows.splice(0, 1)[0];
        params.forEach(function (param) {               // 複数件対応
          var rownum = findRow(sheet, param['id'], 1);  // idで検索
          var row = [];
          keys.forEach(function (key) {
            if (key == "updatetime") {
              row.push(nowdt);
            }
            else if(key == "updateuser"){
              row.push(userid);
            }
            else {
              row.push(param[key]);
            }
          });
          Logger.log("Params: id " + param.id + " / ROWNUM:" + rownum);
          if (rownum > 0) {
            sheet.getRange(rownum, 1, 1, row.length).setValues([row]);
            Logger.log("Update: " + row[0]);
          } else {
            rownum = maxRow(sheet, 1);
            row[0] = (modeSt + "/" + ('0000' + rownum).slice(-4));
            Logger.log("Append: " + row[0]);
            sheet.appendRow(row);
          };
        });
        retdata = JSON.stringify({ status: 'ok' });
        idsheet.getRange(userrow, 3).setValue("");
      } else {
        retdata = JSON.stringify({ status: 'ng(no auth)' });
        idsheet.getRange(userrow, 3).setValue("");
      }

    } else {
      // 何も指定が無いとき（全データ取得）
      retdata = JSON.stringify(getData(sheet));
    };

    Logger.log(retdata);
    return ContentService.createTextOutput(retdata).setMimeType(ContentService.MimeType.JSON);
  }

  /**
   * Handle POST from client (FormData).
   * Expected fields: lat, lng, type, title, body (photo ignored in this simple handler)
   * Appends a new row to the "activity" sheet and returns JSON {ok: true} on success.
   */
  function doPost(e) {
    try {
      // e.postData may be null when multipart/form-data is used; use e.parameters for text fields
      var params = e.parameter || {};
      // For some deployments, fields may appear in e.parameters as arrays
      var lat = Array.isArray(params.lat) ? params.lat[0] : params.lat || '';
      var lng = Array.isArray(params.lng) ? params.lng[0] : params.lng || '';
      var type = Array.isArray(params.type) ? params.type[0] : params.type || '';
      var title = Array.isArray(params.title) ? params.title[0] : params.title || '';
      var body = Array.isArray(params.body) ? params.body[0] : params.body || '';

      var ss = SpreadsheetApp.openById(SpreadsheetApp.getActiveSpreadsheet().getId());
      var sheet = ss.getSheetByName('activity');
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'no activity sheet' })).setMimeType(ContentService.MimeType.JSON);
      }

      // Build a row object according to existing sheet headers
      var headers = sheet.getDataRange().getValues()[0]; // first row
      var row = [];
      var now = new Date();
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i];
        switch (h) {
          case 'id':
            // create a simple id using type + timestamp
            row.push((type || 'user') + '/' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMddHHmmss'));
            break;
          case 'lat':
            row.push(lat);
            break;
          case 'lng':
            row.push(lng);
            break;
          case 'type':
            row.push(type);
            break;
          case 'title':
            row.push(title);
            break;
          case 'body':
          case 'memo':
            row.push(body);
            break;
          case 'updatetime':
            row.push(now);
            break;
          default:
            // if header not recognized, push empty cell
            row.push('');
        }
      }

      // Append row to sheet
      sheet.appendRow(row);

      return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  function getData(sheet) {
    var rows = sheet.getDataRange().getValues();
    var keys = rows.splice(0, 1)[0];
    return rows.map(function (row) {
      var obj = {};
      row.map(function (item, index) {
        obj[keys[index]] = item;
      });
      return obj;
    });
  }

  function findRow(sh, val, col) {
    var dat = sh.getDataRange().getValues(); //受け取ったシートのデータを二次元配列に取得
    for (var i = 1; i < dat.length; i++) {
      //Logger.log("findRow: ROW:" + i + " / Data: " + dat[i][col-1] + " VS " + val);
      if (dat[i][col - 1] == val) {
        Logger.log("findRow: FOUND " + i + " " + val);
        return i + 1;
      }
    }
    return 0;
  }

  function maxRow(sheet, col) {
    var maxnum = 0, nownum = 0;
    var dat = sheet.getDataRange().getValues(); //受け取ったシートのデータを二次元配列に取得
    for (var i = 1; i < dat.length; i++) {
      nownum = parseInt(dat[i][col - 1].slice(-4));
      if (nownum > maxnum) { maxnum = nownum };
    }
    Logger.log("maxRow: " + maxnum);
    return maxnum + 1;
  };

  function makeSHA256(input) {
    var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
    var txtHash = '';
    for (i = 0; i < rawHash.length; i++) {
      var hashVal = rawHash[i];
      if (hashVal < 0) {
        hashVal += 256;
      }
      if (hashVal.toString(16).length == 1) {
        txtHash += '0';
      }
      txtHash += hashVal.toString(16);
    }
    return txtHash;
  };

  function makeSalt() {
    var m = 15, s = "", r = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < m; i++) { s += r.charAt(Math.floor(Math.random() * r.length)); }
    return s;
  };
