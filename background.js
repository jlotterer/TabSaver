chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveTabs") {
    chrome.windows.getAll({ populate: true }, (windows) => {
      let allTabs = [];

      let groupPromises = [];

      windows.forEach(window => {
        let windowTabs = {
          windowId: window.id,
          tabs: [],
          groups: {}
        };

        window.tabs.forEach(tab => {
          if (chrome.tabGroups && chrome.tabGroups.TAB_GROUP_ID_NONE !== undefined && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
            let groupPromise = new Promise((resolve, reject) => {
              chrome.tabGroups.get(tab.groupId, (group) => {
                if (group) {
                  if (!windowTabs.groups[group.id]) {
                    windowTabs.groups[group.id] = {
                      id: group.id,
                      title: group.title || '', // Use default title if undefined
                      color: group.color || '', // Use default color if undefined
                      tabs: []
                    };
                  }
                  windowTabs.groups[group.id].tabs.push({
                    url: tab.url,
                    title: tab.title
                  });
                  resolve();
                } else {
                  console.warn(`Tab group with ID ${tab.groupId} not found.`);
                  resolve();
                }
              });
            });
            groupPromises.push(groupPromise);
          } else {
            windowTabs.tabs.push({
              url: tab.url,
              title: tab.title
            });
          }
        });

        allTabs.push(windowTabs);
      });

      Promise.all(groupPromises).then(() => {
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
