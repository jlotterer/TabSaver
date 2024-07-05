chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveTabs") {
    chrome.windows.getAll({ populate: true }, (windows) => {
      let allTabs = [];

      windows.forEach(window => {
        let windowTabs = {
          windowId: window.id,
          tabs: [],
          groups: {}
        };

        window.tabs.forEach(tab => {
          if (chrome.tabGroups && chrome.tabGroups.TAB_GROUP_ID_NONE !== undefined && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
            chrome.tabGroups.get(tab.groupId, (group) => {
              if (group) {
                if (!windowTabs.groups[group.id]) {
                  windowTabs.groups[group.id] = {
                    title: group.title || '', // Use default title if undefined
                    color: group.color || '', // Use default color if undefined
                    tabs: []
                  };
                }
                windowTabs.groups[group.id].tabs.push({
                  url: tab.url,
                  title: tab.title
                });
              } else {
                console.warn(`Tab group with ID ${tab.groupId} not found.`);
              }
            });
          } else {
            windowTabs.tabs.push({
              url: tab.url,
              title: tab.title
            });
          }
        });

        allTabs.push(windowTabs);
      });

      // Wait for all chrome.tabGroups.get() calls to complete before saving
      Promise.all(allTabs.map(windowTabs =>
        Promise.all(Object.values(windowTabs.groups).map(group =>
          new Promise(resolve =>
            chrome.tabGroups.get(group.id, g => {
              if (g) {
                group.title = g.title || '';
                group.color = g.color || '';
              } else {
                console.warn(`Tab group with ID ${group.id} not found.`);
              }
              resolve();
            })
          )
        ))
      )).then(() => {
        chrome.storage.local.set({ savedTabs: allTabs }, () => {
          sendResponse({ status: "success" });
        });
      }).catch(error => {
        console.error("Error saving tabs:", error);
        sendResponse({ status: "error", message: error.message });
      });
    });

    return true; // Keep the message channel open for sendResponse
  }
});
