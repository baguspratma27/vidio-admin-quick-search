/**
 * Vidio Admin Helper - Multi-Package Support (Updated with Bold Query)
 */

const CONFIG = {
  SEARCH_ID: "vidioQuickSearch",
  BASE_URL: "https://www.vidio.com/admin"
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONFIG.SEARCH_ID,
      title: "Cari di Admin: '%s'",
      contexts: ["selection"]
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONFIG.SEARCH_ID) {
    const rawQuery = info.selectionText.trim();
    const isGpaSearch = rawQuery.toUpperCase().startsWith('GPA.');
    
    const startUrl = isGpaSearch 
      ? `${CONFIG.BASE_URL}/transactions` 
      : `${CONFIG.BASE_URL}/users`;

    chrome.tabs.create({ url: startUrl }, (newTab) => {
      let step = 0;
      const watcher = (id, change) => {
        if (id !== newTab.id || change.status !== 'complete') return;

        chrome.tabs.get(id, (currentTab) => {
          const path = currentTab.url;

          if (step === 0 && !path.match(/\/\d+/)) {
            chrome.scripting.executeScript({
              target: { tabId: id },
              func: runFilterLogic,
              args: [rawQuery]
            });
            step = 1;
          } 
          else if (step === 1) {
            setTimeout(() => {
              chrome.scripting.executeScript({
                target: { tabId: id },
                func: () => {
                  const lnk = [...document.querySelectorAll('a')].find(a => a.innerText.trim() === 'Show');
                  if (lnk) lnk.click();
                }
              });
              step = 2;
            }, 1200); 
          }
          else if (step === 2 && path.match(/\/\d+/)) {
            setTimeout(() => {
              chrome.scripting.executeScript({
                target: { tabId: id },
                func: copyActivePackageLogic,
                args: [rawQuery] 
              });
            }, 1500);
            chrome.tabs.onUpdated.removeListener(watcher);
          }
        });
      };
      chrome.tabs.onUpdated.addListener(watcher);
    });
  }
});

function runFilterLogic(str) {
  const getField = (keys) => {
    const labels = [...document.querySelectorAll('label')];
    const targetLabel = labels.find(l => keys.some(k => l.innerText.toUpperCase().includes(k)));
    if (!targetLabel) return null;
    return targetLabel.nextElementSibling?.querySelector('input') || document.getElementById(targetLabel.getAttribute('for'));
  };
  const isEmail = str.includes('@');
  const isID = str.includes(':') || (/^\d+$/.test(str) && !str.startsWith('8'));
  const isPhone = /^\d+$/.test(str) && str.startsWith('8');
  let el = null;
  if (str.toUpperCase().startsWith('GPA')) el = getField(['GOOGLE ORDERID', 'GPA']);
  else if (isEmail) el = getField(['EMAIL']);
  else if (isID) el = getField(['PARTNER ID']);
  else if (isPhone) el = getField(['PHONE']);
  else el = getField(['USERNAME']);

  if (el) {
    el.value = str;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    const btn = [...document.querySelectorAll('input, button')].find(b => 
      ['Filter', 'Search'].includes((b.value || b.innerText || "").trim())
    );
    if (btn) btn.click();
  }
}

function copyActivePackageLogic(query) {
  function showToast(msg, color = "#2ecc71") {
    const t = document.createElement('div');
    t.innerHTML = `<strong>${msg}</strong><br><small>Silakan Paste (Ctrl+V) sekarang</small>`;
    t.style = `position:fixed; top:20px; right:20px; background:${color}; color:white; padding:15px 25px; border-radius:10px; z-index:999999; font-family:sans-serif; box-shadow:0 10px 20px rgba(0,0,0,0.3); border-left: 8px solid rgba(0,0,0,0.2); transition: all 0.5s ease;`;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, 4500);
  }

  let kalimatFinal = `Hallo rekan, setelah dicek pada akun ${query} tidak terdapat paket aktif terima kasih`;
  let isFound = false;

  const section = [...document.querySelectorAll('h2, h3, strong, .panel-heading')]
    .find(e => e.innerText.includes('Subscriptions'));
  
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
    const table = section.closest('.panel, .section, .box, div')?.querySelector('table');
    
    if (table) {
      const rows = [...table.querySelectorAll('tbody tr')];
      const activeRows = rows.filter(row => {
          return [...row.cells].some(c => c.innerText.trim().toUpperCase() === 'YES');
      });

      if (activeRows.length > 0) {
        isFound = true;
        if (activeRows.length === 1) {
          const cells = activeRows[0].cells;
          const namaPaket = cells[1]?.innerText.trim() || "-"; 
          const tanggalPaket = cells[5]?.innerText.trim() || "-";
          
          kalimatFinal = `Hallo rekan, setelah dilakukan pengecekan untuk akun ${query} tersebut memiliki paket aktif ${namaPaket} hingga tanggal ${tanggalPaket} terima kasih`;
          activeRows[0].style.backgroundColor = "#d4edda";
        } else {
          let listPaket = "";
          activeRows.forEach((row, index) => {
            const cells = row.cells;
            const namaPaket = cells[1]?.innerText.trim() || "-"; 
            const tanggalPaket = cells[5]?.innerText.trim() || "-";
            listPaket += `${index + 1}. ${namaPaket} hingga tanggal ${tanggalPaket}\n`;
            row.style.backgroundColor = "#d4edda";
          });

          kalimatFinal = `Hallo rekan, setelah dilakukan pengecekan untuk akun ${query} tersebut memiliki beberapa paket aktif sebagai berikut:\n${listPaket}\nDemikian rekan, terima kasih.`;
        }
      }
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = kalimatFinal;
  document.body.appendChild(textArea);
  textArea.select();
  
  try {
    document.execCommand('copy');
    isFound ? showToast(`✅ PAKET AKTIF DISALIN`) : showToast(`⚠️ INFO: TIDAK ADA PAKET`, "#e67e22");
  } catch (err) {
    console.error('Gagal copy:', err);
  }
  document.body.removeChild(textArea);
}
