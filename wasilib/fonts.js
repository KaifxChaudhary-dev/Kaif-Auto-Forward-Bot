const fonts = {
    original: (text) => text,
    typewriter: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = 'ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ０１２３４５６７８９';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    bold: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    italic: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    bolditalic: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '𝙖𝙗𝙘𝙙𝙚𝙛𝙜𝙝𝙞𝙟𝙠𝙡𝙢𝙣𝙤𝙥𝙦𝙧𝙨𝙩𝙪𝙫𝙬𝙭𝙮𝙯𝘼𝘽𝘾𝘿𝙀𝙁𝙂𝙃𝙄𝙅𝙆𝙇𝙈𝙉𝙊𝙋𝙌𝙍𝙎𝙏𝙐𝙑𝙒𝙓𝙔𝙕0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    script: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '𝒶𝒷𝒸𝒹𝑒𝒻𝑔𝒽𝒾𝒿𝓀𝓁𝓂𝓃𝑜𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏𝒜𝐵𝒞𝒟𝐸𝐹𝒢𝐻𝐼𝒥𝒦𝐿𝑀𝒩𝒪𝒫𝒬𝑅𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    boldscript: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    fraktur: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔚𝔛𝔜ℨ0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    boldfraktur: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟𝕬𝕭𝕮𝕯𝕰𝕱𝕲𝕳𝕴𝕵𝕶𝕷𝕸𝕹𝕺𝕻𝕼𝕽𝕾𝕿𝖀𝖁𝖂𝖃𝖄𝖅0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    double: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    monospace: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    circle: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = 'ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ⓪①②③④⑤⑥⑦⑧⑨';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    filledcircle: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '🅐🅑🅒🅓🅔🅕🅖🅗🅘🅙🅚🅛🅜🅝🅞🅟🅠🅡🅢🅣🅤🅥🅦🅧🅨🅩🅐🅑🅒🅓🅔🅕🅖🅗🅘🅙🅚🅛🅜🅝🅞🅟🅠🅡🅢🅣🅤🅥🅦🅧🅨🅩⓿❶❷❸❹❺❻❼❽❾';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    square: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '🄰🄱🄲🄳🄴🄵🄶🄷🄼🄹🄺🄻🄼🄽🄾🄿🄱🅁🅂🅃🅄🅅🅆🅇🅈🅉🄰🄱🄲🄳🄴🄵🄶🄷ℑ🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    filledsquare: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    smallcaps: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    parenthesis: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '⒜⒝⒞⒟⒠⒡⒢⒣⒤⒥⒦⒧⒨⒩⒪⒫⒬⒭⒮⒯⒰⒱⒲⒳⒴⒵⒜⒝⒞⒟⒠⒡⒢⒣⒤⒥⒦⒧⒨⒩⒪⒫⒬⒭⒮⒯⒰⒱⒲⒳⒴⒵⑴⑵⑶⑷⑸⑹⑺⑻⑼';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    wide: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = 'ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ０１２３４５６７８９';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    currency: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = 'αв¢∂єƒgнιנкℓмησρqяѕтυνωкуzαв¢∂єƒgнιנкℓмησρ¢яѕтυν ωкуz0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    greek: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = 'αвc∂εғgнιjкℓмησρqяsтυνωxүzαвc∂εғgнιjкℓмησρqяsтυνωxүz0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    gothic: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟𝕬𝕭𝕮𝕯𝕰𝕱𝕲𝕳𝕴𝕵𝕶𝕷𝕸𝕹𝕺𝕻𝕼𝕽𝕾𝕿𝖀𝖁𝖂𝖃𝖄𝖅0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    medieval: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔚𝔛𝔜ℨ0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    weird: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = 'αвçđēfģħĭjķļmŉōpqřşťūvŵχyzAβÇĐĒFĢĦĬJĶĻMŃŌPQŘŞŤŪVŴΧYZ0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    bubble: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = 'ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    slant: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    luxury: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    tiny: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖᵠʳˢᵗᵘᵛʷˣʸᶻᴬᴮᶜᴰᴱᶠᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᵠᴿˢᵀᵁⱽᵂˣʸᶻ⁰¹²³⁴⁵⁶⁷⁸⁹';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    inverted: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = 'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎzⱯᗺƆᗡƎℲ⅁HIᒋꓘꓶWNOԀꓨᴚSꓕ∩ɅMX⅄Z0123456789';
        return text.split('').reverse().map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    mirror: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = 'AdↄbɘᎸǫʜiꞁʞlmnopqɿꙅƚυνwxyzAᗺƆᗡƎℲᎮHIႱꓘ⅃MИOꟼϘᴙꙄTUVWXYZ0123456789';
        return text.split('').reverse().map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    symbols: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = 'αв¢∂єƒgнιנкℓмησρ¢яѕтυν ωкуzαв¢∂єƒgнιנкℓмησρ¢яѕтυν ωкуz0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    hacker: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = '4bcd3fghijk1mn0pqr57uvwxyz4BCD3FGHIJK1MN0PQR57UVWXYZ0123456789';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('');
    },
    aesthetic: (text) => {
        const from = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const map = 'ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ０１２３４５６７８９';
        return text.split('').map(char => {
            const index = from.indexOf(char);
            return index >= 0 ? [...map][index] : char;
        }).join('  ');
    },
    fancy1: (text) => {
        return `★彡 ${text} 彡★`;
    },
    fancy2: (text) => {
        return `◦•●◉✿ ${text} ✿◉●•◦`;
    },
    fancy3: (text) => {
        return `◤ ${text} ◢`;
    },
    fancy4: (text) => {
        return `【 ${text} 】`;
    },
    fancy5: (text) => {
        return `『 ${text} 』`;
    },
    fancy6: (text) => {
        return `≋ ${text} ≋`;
    },
    fancy7: (text) => {
        return `░ ${text} ░`;
    },
    fancy8: (text) => {
        return `▓ ${text} ▓`;
    },
    fancy9: (text) => {
        return `▒ ${text} ▒`;
    },
    fancy10: (text) => {
        return `█║▌│█║▌ ${text} █║▌│█║▌`;
    },
    fancy11: (text) => {
        return `༺ ${text} ༻`;
    },
    fancy12: (text) => {
        return `♛ ${text} ♛`;
    },
    fancy13: (text) => {
        return `⚡ ${text} ⚡`;
    },
    fancy14: (text) => {
        return `✨ ${text} ✨`;
    },
    fancy15: (text) => {
        return `🔥 ${text} 🔥`;
    }
};

const applyFont = (text, fontStyle = 'original') => {
    if (!text) return text;
    if (fonts[fontStyle]) {
        return fonts[fontStyle](text);
    }
    return text;
};

module.exports = { fonts, applyFont };
