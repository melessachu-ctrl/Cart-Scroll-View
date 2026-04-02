(function () {
  var refreshCheckoutModalIfOpen = function () {};

  var group = document.getElementById("hktvmall-group");
  var toggleChev = document.getElementById("toggle-hktvmall");
  if (toggleChev && group) {
    toggleChev.addEventListener("click", function () {
      group.classList.toggle("is-collapsed");
      toggleChev.style.transform = group.classList.contains("is-collapsed") ? "rotate(180deg)" : "";
    });
  }

  var merchantGroup = document.getElementById("merchant-group");
  var merchantHead = document.getElementById("toggle-merchant-head");
  var merchantChev = document.getElementById("toggle-merchant-chev");
  if (merchantGroup && merchantHead) {
    merchantHead.addEventListener("click", function () {
      merchantGroup.classList.toggle("is-collapsed");
      if (merchantChev) {
        merchantChev.style.transform = merchantGroup.classList.contains("is-collapsed") ? "rotate(180deg)" : "";
      }
    });
  }

  var sizeBtns = document.querySelectorAll(".img-sizes [data-size]");
  var shell = document.querySelector(".app-shell");
  sizeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      sizeBtns.forEach(function (b) {
        b.classList.remove("is-active");
      });
      btn.classList.add("is-active");
      var s = btn.getAttribute("data-size") || "S";
      if (shell) shell.setAttribute("data-img-size", s);
    });
  });
  if (shell) shell.setAttribute("data-img-size", "S");

  var changeBtn = document.getElementById("btn-change-time");
  var mergeTimeslotText = document.getElementById("merge-timeslot-text");
  var option3hrTimeslotText = document.getElementById("option-3hr-timeslot-text");
  var timeslotModal = document.getElementById("timeslot-modal");
  var timeslotBackdrop = document.getElementById("timeslot-backdrop");
  var timeslotClose = document.getElementById("timeslot-close");
  var timeslotConfirm = document.getElementById("timeslot-confirm");
  var timeslotSeg3hr = document.getElementById("timeslot-seg-3hr");
  var timeslotSegMerge = document.getElementById("timeslot-seg-merge");
  var timeslotDateRow = document.getElementById("timeslot-date-row");
  var timeslotTimeRow = document.getElementById("timeslot-time-row");
  var timeslotDateViewport = timeslotDateRow ? timeslotDateRow.closest(".timeslot-wheel__viewport") : null;
  var timeslotTimeViewport = timeslotTimeRow ? timeslotTimeRow.closest(".timeslot-wheel__viewport") : null;

  var modalMode3hr = "3hr";
  var modalModeMerge = "merge";
  var modalMode = modalModeMerge;
  /** 從「3小時送達」點「更改」開啟 modal 時為 true，確認後強制切換為一併送 */
  var forceMergeOnTimeslotConfirm = false;
  var wheelOptions = {
    merge: {
      dates: ["今天", "明天", "後天", "01/04 (星期三)", "02/04 (星期四)", "03/04 (星期五)"],
      times: [
        "10:00 - 12:30 (已滿)",
        "12:30 - 15:00 (已滿)",
        "15:00 - 18:00",
        "18:00 - 21:00",
        "21:00 - 23:00"
      ]
    },
    "3hr": {
      dates: ["今日"],
      times: ["12:30 - 15:00"]
    }
  };
  var selectedByMode = {
    merge: { date: "明天", time: "15:00 - 18:00" },
    "3hr": { date: "今日", time: "12:30 - 15:00" }
  };
  var draftByMode = {
    merge: { date: "明天", time: "15:00 - 18:00" },
    "3hr": { date: "今日", time: "12:30 - 15:00" }
  };
  var wheelItemHeight = 44;
  var wheelScrollTimers = { date: null, time: null };

  function setModalSegment(mode) {
    modalMode = mode;
    if (timeslotSeg3hr) timeslotSeg3hr.classList.toggle("is-active", mode === modalMode3hr);
    if (timeslotSegMerge) timeslotSegMerge.classList.toggle("is-active", mode === modalModeMerge);
  }

  function isOptionDisabled(columnKey, label) {
    return columnKey === "time" && label.indexOf("已滿") !== -1;
  }

  function hasSelectedTomorrowDeliverySku() {
    var cards = document.querySelectorAll("#hktvmall-group .product-card.is-selected");
    for (var i = 0; i < cards.length; i++) {
      var label = cards[i].querySelector(".delivery-label");
      if (label && label.textContent.indexOf("明天送達") !== -1) return true;
    }
    return false;
  }

  function getEffectiveMergeDates() {
    var base = wheelOptions.merge.dates;
    if (hasSelectedTomorrowDeliverySku()) {
      return base.filter(function (d) {
        return d !== "今天";
      });
    }
    return base.slice();
  }

  function ensureMergeDraftDateValid() {
    if (modalMode !== modalModeMerge) return;
    var dates = getEffectiveMergeDates();
    if (dates.indexOf(draftByMode.merge.date) === -1) {
      draftByMode.merge.date = dates[0] || "明天";
    }
  }

  function normalizeDraftTimeIfMissing(modeKey) {
    if (modeKey === "3hr") {
      var d3 = wheelOptions["3hr"].dates;
      var t3 = wheelOptions["3hr"].times;
      if (draftByMode["3hr"].date === "今天") draftByMode["3hr"].date = "今日";
      if (d3.indexOf(draftByMode["3hr"].date) === -1) draftByMode["3hr"].date = d3[0];
      if (t3.indexOf(draftByMode["3hr"].time) === -1) draftByMode["3hr"].time = t3[0];
      return;
    }
    var times = wheelOptions[modeKey].times;
    var t = draftByMode[modeKey].time;
    if (times.indexOf(t) !== -1) return;
    if (t === "12:30 - 15:00" && times.indexOf("12:30 - 15:00 (已滿)") !== -1) {
      draftByMode[modeKey].time = "12:30 - 15:00 (已滿)";
      return;
    }
    var j;
    for (j = 0; j < times.length; j++) {
      if (!isOptionDisabled("time", times[j])) {
        draftByMode[modeKey].time = times[j];
        return;
      }
    }
    draftByMode[modeKey].time = times[0];
  }

  function syncTimeslotConfirmButton() {
    if (!timeslotConfirm) return;
    var t = draftByMode[modalMode].time;
    var dis = isOptionDisabled("time", t);
    timeslotConfirm.disabled = dis;
    timeslotConfirm.classList.toggle("is-disabled", dis);
    timeslotConfirm.setAttribute("aria-disabled", dis ? "true" : "false");
  }

  function clampIndex(index, max) {
    if (index < 0) return 0;
    if (index > max) return max;
    return index;
  }

  function syncWheelActiveClass(columnKey) {
    var listEl = columnKey === "date" ? timeslotDateRow : timeslotTimeRow;
    if (!listEl) return;
    var activeValue = draftByMode[modalMode][columnKey];
    Array.prototype.forEach.call(listEl.children, function (node) {
      node.classList.toggle("is-active", node.dataset.value === activeValue);
    });
  }

  function getWheelDateOptions() {
    if (modalMode === modalModeMerge) return getEffectiveMergeDates();
    return wheelOptions[modalMode].dates;
  }

  function snapWheel(columnKey, smooth) {
    var listEl = columnKey === "date" ? timeslotDateRow : timeslotTimeRow;
    var viewportEl = columnKey === "date" ? timeslotDateViewport : timeslotTimeViewport;
    if (!listEl || !viewportEl) return;
    var options =
      columnKey === "date" ? getWheelDateOptions() : wheelOptions[modalMode].times;
    if (!options || options.length === 0) return;

    var rawIndex = Math.round(viewportEl.scrollTop / wheelItemHeight);
    var targetIndex = clampIndex(rawIndex, options.length - 1);
    draftByMode[modalMode][columnKey] = options[targetIndex];
    syncWheelActiveClass(columnKey);

    var targetTop = targetIndex * wheelItemHeight;
    if (Math.abs(viewportEl.scrollTop - targetTop) > 0.5) {
      viewportEl.scrollTo({ top: targetTop, behavior: smooth ? "smooth" : "auto" });
    }
    syncTimeslotConfirmButton();
  }

  function bindWheelScroll() {
    if (timeslotDateViewport) {
      timeslotDateViewport.addEventListener("scroll", function () {
        clearTimeout(wheelScrollTimers.date);
        wheelScrollTimers.date = setTimeout(function () {
          snapWheel("date", true);
        }, 80);
      });
    }
    if (timeslotTimeViewport) {
      timeslotTimeViewport.addEventListener("scroll", function () {
        clearTimeout(wheelScrollTimers.time);
        wheelScrollTimers.time = setTimeout(function () {
          snapWheel("time", true);
        }, 80);
      });
    }
  }

  function renderWheel() {
    if (!timeslotDateRow || !timeslotTimeRow) return;
    ensureMergeDraftDateValid();
    normalizeDraftTimeIfMissing(modalMode);
    var dateOptions = getWheelDateOptions();
    var timeOptions = wheelOptions[modalMode].times;
    var draft = draftByMode[modalMode];
    timeslotDateRow.innerHTML = "";
    timeslotTimeRow.innerHTML = "";

    dateOptions.forEach(function (label) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "timeslot-wheel__item" + (draft.date === label ? " is-active" : "");
      btn.textContent = label;
      btn.dataset.value = label;
      btn.addEventListener("click", function () {
        var idx = dateOptions.indexOf(label);
        if (timeslotDateViewport && idx >= 0) {
          timeslotDateViewport.scrollTop = idx * wheelItemHeight;
        }
        draftByMode[modalMode].date = label;
        syncWheelActiveClass("date");
        syncTimeslotConfirmButton();
      });
      timeslotDateRow.appendChild(btn);
    });

    timeOptions.forEach(function (label) {
      var btn = document.createElement("button");
      btn.type = "button";
      var dis = isOptionDisabled("time", label);
      btn.className =
        "timeslot-wheel__item" +
        (draft.time === label ? " is-active" : "") +
        (dis ? " timeslot-wheel__item--disabled" : "");
      btn.textContent = label;
      btn.dataset.value = label;
      btn.addEventListener("click", function () {
        var idx = timeOptions.indexOf(label);
        if (timeslotTimeViewport && idx >= 0) {
          timeslotTimeViewport.scrollTop = idx * wheelItemHeight;
        }
        draftByMode[modalMode].time = label;
        syncWheelActiveClass("time");
        syncTimeslotConfirmButton();
      });
      timeslotTimeRow.appendChild(btn);
    });

    requestAnimationFrame(function () {
      var dateIndex = dateOptions.indexOf(draftByMode[modalMode].date);
      var timeIndex = timeOptions.indexOf(draftByMode[modalMode].time);
      if (dateIndex < 0) dateIndex = 0;
      if (timeIndex < 0) timeIndex = 0;
      if (timeslotDateViewport) {
        timeslotDateViewport.scrollTop = Math.max(0, dateIndex) * wheelItemHeight;
        snapWheel("date", false);
      }
      if (timeslotTimeViewport) {
        timeslotTimeViewport.scrollTop = Math.max(0, timeIndex) * wheelItemHeight;
        snapWheel("time", false);
      }
      syncTimeslotConfirmButton();
    });
  }

  function buildTimeslotText(dateLabel, timeLabel) {
    return dateLabel + " " + timeLabel.replace(/\s/g, "");
  }

  function openTimeslotModal() {
    if (!timeslotModal) return;
    draftByMode.merge = { date: selectedByMode.merge.date, time: selectedByMode.merge.time };
    draftByMode["3hr"] = { date: selectedByMode["3hr"].date, time: selectedByMode["3hr"].time };
    normalizeDraftTimeIfMissing("merge");
    normalizeDraftTimeIfMissing("3hr");
    /* 「更改」只編輯一併送時段：一律顯示一併送輪盤（含從 3小時切回一併送） */
    setModalSegment(modalModeMerge);
    ensureMergeDraftDateValid();
    renderWheel();
    timeslotModal.classList.add("is-open");
    timeslotModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeTimeslotModal() {
    if (!timeslotModal) return;
    timeslotModal.classList.remove("is-open");
    timeslotModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    forceMergeOnTimeslotConfirm = false;
    var checkoutModalEl = document.getElementById("checkout-confirm-modal");
    if (checkoutModalEl && checkoutModalEl.classList.contains("is-open")) {
      document.body.style.overflow = "hidden";
    }
  }

  function applyTimeslotSelection() {
    if (isOptionDisabled("time", draftByMode[modalMode].time)) return;
    selectedByMode.merge = { date: draftByMode.merge.date, time: draftByMode.merge.time };
    selectedByMode["3hr"] = { date: draftByMode["3hr"].date, time: draftByMode["3hr"].time };
    if (mergeTimeslotText) {
      mergeTimeslotText.textContent = buildTimeslotText(selectedByMode.merge.date, selectedByMode.merge.time);
    }
    if (option3hrTimeslotText) {
      option3hrTimeslotText.textContent = buildTimeslotText(selectedByMode["3hr"].date, selectedByMode["3hr"].time);
    }
    if (forceMergeOnTimeslotConfirm) {
      applyDeliveryMode(MODE_MERGE);
      forceMergeOnTimeslotConfirm = false;
    } else {
      applyDeliveryMode(modalMode === modalMode3hr ? MODE_3HR_ONLY : MODE_MERGE);
    }
    syncAllParentsAndFooter();
    refreshCheckoutModalIfOpen();
  }

  if (changeBtn) {
    changeBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      forceMergeOnTimeslotConfirm = currentDeliveryMode === "3hr";
      openTimeslotModal();
    });
  }
  if (timeslotBackdrop) {
    timeslotBackdrop.addEventListener("click", closeTimeslotModal);
  }
  if (timeslotClose) {
    timeslotClose.addEventListener("click", closeTimeslotModal);
  }
  if (timeslotSeg3hr) {
    timeslotSeg3hr.addEventListener("click", function () {
      setModalSegment(modalMode3hr);
      renderWheel();
    });
  }
  if (timeslotSegMerge) {
    timeslotSegMerge.addEventListener("click", function () {
      setModalSegment(modalModeMerge);
      renderWheel();
    });
  }
  if (timeslotConfirm) {
    timeslotConfirm.addEventListener("click", function () {
      if (timeslotConfirm.disabled) return;
      applyTimeslotSelection();
      closeTimeslotModal();
    });
  }
  bindWheelScroll();
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && timeslotModal && timeslotModal.classList.contains("is-open")) {
      closeTimeslotModal();
    }
  });

  var inspireTabs = document.querySelectorAll(".inspire-tab");
  inspireTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      inspireTabs.forEach(function (t) {
        t.classList.remove("is-active");
      });
      tab.classList.add("is-active");
    });
  });

  // Checkbox hierarchy:
  // 全選 -> 商戶(HKTVmall/蘇寧) -> 時段(3hr/8hr/明天) -> SKU
  var cartRoot = document.querySelector(".cart-block-stack");
  if (!cartRoot) return;

  var totalPriceEl = document.getElementById("total-price");
  var checkoutBtn = document.getElementById("btn-checkout");
  var hktThresholdBox = document.querySelector(".hktvmall-group .threshold-box");
  var hktThresholdFreeTextEl = document.querySelector(".hktvmall-group .threshold-line--free p");
  var hktThresholdRemainingEl = document.getElementById("hkt-threshold-remaining");
  var hktThresholdProgressEl = document.getElementById("hkt-threshold-progress");
  var option3hr = document.querySelector(".section-delivery-time .option-3hr");
  var optionMerge = document.querySelector(".section-delivery-time .option-merge");
  var deliverySub8 = document.querySelector(".hktvmall-group .delivery-sub--8");
  var deliverySubTmr = document.querySelector(".hktvmall-group .delivery-sub--tmr");
  var MODE_MERGE = "merge";
  var MODE_3HR_ONLY = "3hr";
  var currentDeliveryMode = MODE_MERGE;

  var selectAllCheckbox = document.querySelector(".select-all-bar .cb-img");
  var hktMerchantCheckbox = document.querySelector(".hktvmall-group__head .cb-white");
  var hktDeliverySections = Array.prototype.slice.call(document.querySelectorAll(".hktvmall-group .delivery-sub"));
  var hktSectionCheckboxes = hktDeliverySections.map(function (section) {
    return section.querySelector(".sub-head-cb");
  });
  var merchantCheckbox = document.querySelector(".merchant-group__head .cb-white");

  function parseQtyFromQtyEl(el) {
    if (!el) return 1;
    var m = (el.textContent || "").match(/x\s*(\d+)/i);
    if (!m) return 1;
    var n = parseInt(m[1], 10);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(99, n));
  }

  function setSkuQty(item, qty) {
    var n = Math.max(1, Math.min(99, qty));
    item.qty = n;
    if (item.qtyEl) item.qtyEl.textContent = "x" + n;
  }

  var skuCards = Array.prototype.slice.call(cartRoot.querySelectorAll(".product-card"));
  var skuItems = skuCards
    .map(function (card) {
      var cb = card.querySelector(".check-pos");
      var priceEl = card.querySelector(".price");
      var qtyEl = card.querySelector(".qty");
      if (!cb || !priceEl) return null;
      return {
        card: card,
        checkbox: cb,
        qtyEl: qtyEl,
        unitPrice: parsePrice(priceEl.textContent || "0"),
        qty: parseQtyFromQtyEl(qtyEl),
        deliveryLabel: (card.querySelector(".delivery-label") && card.querySelector(".delivery-label").textContent || "").trim(),
        disabled: false
      };
    })
    .filter(Boolean);

  var skuByCheckbox = new Map();
  skuItems.forEach(function (item) {
    skuByCheckbox.set(item.checkbox, item);
  });

  function parsePrice(raw) {
    var value = (raw || "").replace(/[^0-9.]/g, "");
    var parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function setChecked(checkboxEl, checked) {
    if (!checkboxEl) return;
    checkboxEl.dataset.checked = checked ? "1" : "0";
    checkboxEl.setAttribute("aria-checked", checked ? "true" : "false");
    checkboxEl.classList.toggle("is-checked", checked);
    checkboxEl.classList.toggle("is-unchecked", !checked);
  }

  function isChecked(checkboxEl) {
    return !!checkboxEl && checkboxEl.dataset.checked === "1";
  }

  function setSkuChecked(item, checked) {
    if (item.disabled && checked) return;
    setChecked(item.checkbox, checked);
    item.card.classList.toggle("is-selected", checked);
  }

  function setSkuDisabled(item, disabled) {
    item.disabled = disabled;
    item.card.classList.toggle("is-disabled", disabled);
    item.checkbox.classList.toggle("is-disabled", disabled);
    item.checkbox.setAttribute("aria-disabled", disabled ? "true" : "false");
    if (disabled) {
      setSkuChecked(item, false);
    }
  }

  function isHktSku(item) {
    var hktGroup = document.getElementById("hktvmall-group");
    return !!hktGroup && hktGroup.contains(item.card);
  }

  function isHkt3hrSku(item) {
    return isHktSku(item) && item.deliveryLabel.indexOf("3小時送達") !== -1;
  }

  function getHktThresholdAmount() {
    return currentDeliveryMode === MODE_3HR_ONLY ? 400 : 300;
  }

  function applyDeliveryMode(mode) {
    currentDeliveryMode = mode;
    if (option3hr) option3hr.classList.toggle("is-selected", mode === MODE_3HR_ONLY);
    if (optionMerge) optionMerge.classList.toggle("is-selected", mode === MODE_MERGE);
    var muted = mode === MODE_3HR_ONLY;
    if (deliverySub8) deliverySub8.classList.toggle("is-delivery-muted", muted);
    if (deliverySubTmr) deliverySubTmr.classList.toggle("is-delivery-muted", muted);

    if (mode === MODE_3HR_ONLY) {
      skuItems.forEach(function (item) {
        if (!isHktSku(item)) return;
        if (isHkt3hrSku(item)) {
          setSkuDisabled(item, false);
          setSkuChecked(item, true);
        } else {
          setSkuDisabled(item, true);
        }
      });
      hktSectionCheckboxes.forEach(function (cb, index) {
        if (!cb) return;
        var disabled = index !== 0;
        cb.classList.toggle("is-disabled", disabled);
        cb.setAttribute("aria-disabled", disabled ? "true" : "false");
        if (disabled) setChecked(cb, false);
      });
    } else {
      skuItems.forEach(function (item) {
        if (isHktSku(item)) {
          setSkuDisabled(item, false);
        }
      });
      hktSectionCheckboxes.forEach(function (cb) {
        if (!cb) return;
        cb.classList.remove("is-disabled");
        cb.setAttribute("aria-disabled", "false");
      });
    }
  }

  function collectSkuItemsIn(containerEl) {
    if (!containerEl) return [];
    return skuItems.filter(function (item) {
      return containerEl.contains(item.card);
    });
  }

  function syncSectionCheckboxesFromSkus() {
    hktSectionCheckboxes.forEach(function (cb, index) {
      if (!cb) return;
      var sectionSkus = collectSkuItemsIn(hktDeliverySections[index]);
      var activeSkus = sectionSkus.filter(function (item) {
        return !item.disabled;
      });
      var allChecked = activeSkus.length > 0 && activeSkus.every(function (item) {
        return isChecked(item.checkbox);
      });
      setChecked(cb, allChecked);
    });
  }

  function syncMerchantCheckboxesFromSkus() {
    var hktSkus = collectSkuItemsIn(document.getElementById("hktvmall-group"));
    var activeHktSkus = hktSkus.filter(function (item) {
      return !item.disabled;
    });
    var allHktChecked = activeHktSkus.length > 0 && activeHktSkus.every(function (item) {
      return isChecked(item.checkbox);
    });
    setChecked(hktMerchantCheckbox, allHktChecked);

    var merchantSkus = collectSkuItemsIn(document.getElementById("merchant-group"));
    var allMerchantChecked = merchantSkus.length > 0 && merchantSkus.every(function (item) {
      return isChecked(item.checkbox);
    });
    setChecked(merchantCheckbox, allMerchantChecked);
  }

  function syncSelectAllFromSkus() {
    var activeSkus = skuItems.filter(function (item) {
      return !item.disabled;
    });
    var allChecked = activeSkus.length > 0 && activeSkus.every(function (item) {
      return isChecked(item.checkbox);
    });
    setChecked(selectAllCheckbox, allChecked);
  }

  function updateFooter() {
    var selected = skuItems.filter(function (item) {
      return !item.disabled && isChecked(item.checkbox);
    });
    var total = selected.reduce(function (sum, item) {
      return sum + item.unitPrice * item.qty;
    }, 0);
    if (totalPriceEl) {
      totalPriceEl.textContent = "$" + total.toFixed(2);
    }
    if (checkoutBtn) {
      checkoutBtn.textContent = "結帳 (" + selected.length + "件)";
    }
  }

  function updateHktThreshold() {
    if (!hktThresholdBox) return;
    var thresholdAmount = getHktThresholdAmount();
    var hktSelectedTotal = collectSkuItemsIn(document.getElementById("hktvmall-group"))
      .filter(function (item) {
        return !item.disabled && isChecked(item.checkbox);
      })
      .reduce(function (sum, item) {
        return sum + item.unitPrice * item.qty;
      }, 0);

    var remaining = Math.max(0, thresholdAmount - hktSelectedTotal);
    var ratio = Math.min(1, hktSelectedTotal / thresholdAmount);

    hktThresholdBox.classList.toggle("is-unmet", remaining > 0);
    if (hktThresholdFreeTextEl) {
      hktThresholdFreeTextEl.textContent = thresholdAmount === 400 ? "Free Delivery over $400" : "已享免運費 送上門";
    }
    if (hktThresholdRemainingEl) {
      hktThresholdRemainingEl.textContent = "$" + remaining.toFixed(2);
    }
    if (hktThresholdProgressEl) {
      hktThresholdProgressEl.style.width = ratio * 100 + "%";
    }
  }

  function syncAllParentsAndFooter() {
    syncSectionCheckboxesFromSkus();
    syncMerchantCheckboxesFromSkus();
    syncSelectAllFromSkus();
    updateFooter();
    updateHktThreshold();
  }

  var qtyModal = document.getElementById("qty-modal");
  var qtyBackdrop = document.getElementById("qty-backdrop");
  var qtyClose = document.getElementById("qty-close");
  var qtyConfirm = document.getElementById("qty-confirm");
  var qtyWheelRow = document.getElementById("qty-wheel-row");
  var qtyWheelViewport = document.getElementById("qty-wheel-viewport");
  var qtyModalItem = null;
  var qtyDraft = 1;
  var QTY_MIN = 1;
  var QTY_MAX = 99;
  var qtyScrollTimer = null;

  function syncQtyWheelActive() {
    if (!qtyWheelRow) return;
    Array.prototype.forEach.call(qtyWheelRow.children, function (node) {
      var v = parseInt(node.dataset.value, 10);
      node.classList.toggle("is-active", v === qtyDraft);
    });
  }

  function scrollQtyToValue(smooth) {
    if (!qtyWheelViewport) return;
    var idx = qtyDraft - QTY_MIN;
    var targetTop = idx * wheelItemHeight;
    qtyWheelViewport.scrollTo({ top: targetTop, behavior: smooth ? "smooth" : "auto" });
  }

  function renderQtyWheel() {
    if (!qtyWheelRow) return;
    qtyWheelRow.innerHTML = "";
    var i;
    for (i = QTY_MIN; i <= QTY_MAX; i += 1) {
      (function (value) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "timeslot-wheel__item" + (value === qtyDraft ? " is-active" : "");
        btn.textContent = String(value);
        btn.dataset.value = String(value);
        btn.addEventListener("click", function () {
          qtyDraft = value;
          syncQtyWheelActive();
          scrollQtyToValue(true);
        });
        qtyWheelRow.appendChild(btn);
      })(i);
    }
    requestAnimationFrame(function () {
      scrollQtyToValue(false);
      syncQtyWheelActive();
    });
  }

  function openQtyModal(item) {
    qtyModalItem = item;
    qtyDraft = item.qty;
    renderQtyWheel();
    if (qtyModal) {
      qtyModal.classList.add("is-open");
      qtyModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
  }

  function closeQtyModal() {
    qtyModalItem = null;
    if (qtyModal) {
      qtyModal.classList.remove("is-open");
      qtyModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
  }

  if (qtyWheelViewport) {
    qtyWheelViewport.addEventListener("scroll", function () {
      clearTimeout(qtyScrollTimer);
      qtyScrollTimer = setTimeout(function () {
        if (!qtyWheelViewport) return;
        var raw = Math.round(qtyWheelViewport.scrollTop / wheelItemHeight);
        var idx = clampIndex(raw, QTY_MAX - QTY_MIN);
        qtyDraft = QTY_MIN + idx;
        syncQtyWheelActive();
        var targetTop = idx * wheelItemHeight;
        if (Math.abs(qtyWheelViewport.scrollTop - targetTop) > 0.5) {
          qtyWheelViewport.scrollTo({ top: targetTop, behavior: "auto" });
        }
      }, 80);
    });
  }

  if (qtyBackdrop) {
    qtyBackdrop.addEventListener("click", closeQtyModal);
  }
  if (qtyClose) {
    qtyClose.addEventListener("click", closeQtyModal);
  }
  if (qtyConfirm) {
    qtyConfirm.addEventListener("click", function () {
      if (qtyModalItem) {
        setSkuQty(qtyModalItem, qtyDraft);
        syncAllParentsAndFooter();
      }
      closeQtyModal();
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && qtyModal && qtyModal.classList.contains("is-open")) {
      closeQtyModal();
    }
  });

  function bindCheckboxClick(checkboxEl, onToggle) {
    if (!checkboxEl) return;
    checkboxEl.setAttribute("role", "checkbox");
    checkboxEl.tabIndex = 0;
    checkboxEl.addEventListener("click", function (event) {
      event.stopPropagation();
      onToggle(!isChecked(checkboxEl));
    });
    checkboxEl.addEventListener("keydown", function (event) {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        onToggle(!isChecked(checkboxEl));
      }
    });
  }

  // 進入頁面預設：全選、商戶、時段與所有 SKU 皆未勾選
  setChecked(selectAllCheckbox, false);
  setChecked(hktMerchantCheckbox, false);
  setChecked(merchantCheckbox, false);
  hktSectionCheckboxes.forEach(function (cb) {
    setChecked(cb, false);
  });
  skuItems.forEach(function (item) {
    setSkuChecked(item, false);
  });

  bindCheckboxClick(selectAllCheckbox, function (checked) {
    skuItems.forEach(function (item) {
      if (!item.disabled) setSkuChecked(item, checked);
    });
    syncAllParentsAndFooter();
  });

  bindCheckboxClick(hktMerchantCheckbox, function (checked) {
    collectSkuItemsIn(document.getElementById("hktvmall-group")).forEach(function (item) {
      if (!item.disabled) setSkuChecked(item, checked);
    });
    syncAllParentsAndFooter();
  });

  bindCheckboxClick(merchantCheckbox, function (checked) {
    collectSkuItemsIn(document.getElementById("merchant-group")).forEach(function (item) {
      setSkuChecked(item, checked);
    });
    syncAllParentsAndFooter();
  });

  hktSectionCheckboxes.forEach(function (cb, index) {
    bindCheckboxClick(cb, function (checked) {
      if (cb.getAttribute("aria-disabled") === "true") return;
      collectSkuItemsIn(hktDeliverySections[index]).forEach(function (item) {
        if (!item.disabled) setSkuChecked(item, checked);
      });
      syncAllParentsAndFooter();
    });
  });

  skuItems.forEach(function (item) {
    bindCheckboxClick(item.checkbox, function (checked) {
      if (item.disabled) {
        applyDeliveryMode(MODE_MERGE);
      }
      setSkuChecked(item, checked);
      syncAllParentsAndFooter();
    });
  });

  skuItems.forEach(function (item) {
    if (!item.qtyEl) return;
    item.qtyEl.addEventListener("click", function (event) {
      event.stopPropagation();
      if (item.disabled || !isChecked(item.checkbox)) return;
      openQtyModal(item);
    });
  });

  if (option3hr) {
    option3hr.addEventListener("click", function () {
      applyDeliveryMode(MODE_3HR_ONLY);
      syncAllParentsAndFooter();
    });
  }

  if (optionMerge) {
    optionMerge.addEventListener("click", function () {
      applyDeliveryMode(MODE_MERGE);
      syncAllParentsAndFooter();
    });
  }

  var checkoutConfirmModal = document.getElementById("checkout-confirm-modal");
  var checkoutConfirmBackdrop = document.getElementById("checkout-confirm-backdrop");
  var checkoutConfirmClose = document.getElementById("checkout-confirm-close");
  var checkoutConfirmProceed = document.getElementById("checkout-confirm-proceed");
  var checkoutEditTimeslot = document.getElementById("checkout-edit-timeslot");
  var checkoutSuccessPage = document.getElementById("checkout-success-page");
  var checkoutSuccessTotalEl = document.getElementById("checkout-success-total");
  var checkoutSuccessDone = document.getElementById("checkout-success-done");
  var CHECKOUT_PLATFORM_FEE = 3;
  var CHECKOUT_BAG_FEE = 2;
  var CHECKOUT_HK_SHIPPING = 25;

  function formatCheckoutMoney(n) {
    return "$" + n.toFixed(1);
  }

  function getCheckoutDeliveryTimeHtml() {
    var mergeEl = document.getElementById("merge-timeslot-text");
    var option3hrEl = document.getElementById("option-3hr-timeslot-text");
    var primary = "";
    if (currentDeliveryMode === MODE_3HR_ONLY && option3hrEl) {
      primary = option3hrEl.textContent.trim();
    } else if (mergeEl) {
      primary = mergeEl.textContent.trim();
    }
    var lines = primary ? [primary] : [];
    var merchantHas = collectSkuItemsIn(document.getElementById("merchant-group")).some(function (item) {
      return !item.disabled && isChecked(item.checkbox);
    });
    if (merchantHas) {
      lines.push("商戶派送 (3-4日送達)");
    }
    return lines.length ? lines.join("<br>") : "—";
  }

  function getCheckoutShippingFee() {
    var fee = 0;
    if (hktThresholdBox && hktThresholdBox.classList.contains("is-unmet")) {
      var hktSel = collectSkuItemsIn(document.getElementById("hktvmall-group")).filter(function (item) {
        return !item.disabled && isChecked(item.checkbox);
      });
      if (hktSel.length > 0) fee += CHECKOUT_HK_SHIPPING;
    }
    return fee;
  }

  function populateCheckoutModal() {
    var selected = skuItems.filter(function (item) {
      return !item.disabled && isChecked(item.checkbox);
    });
    var subtotal = selected.reduce(function (sum, item) {
      return sum + item.unitPrice * item.qty;
    }, 0);
    var shipping = getCheckoutShippingFee();
    var platform = CHECKOUT_PLATFORM_FEE;
    var bag = CHECKOUT_BAG_FEE;
    var grand = subtotal + shipping + platform + bag;

    var elTime = document.getElementById("checkout-delivery-time");
    if (elTime) elTime.innerHTML = getCheckoutDeliveryTimeHtml();

    var subEl = document.getElementById("checkout-subtotal");
    var shipEl = document.getElementById("checkout-shipping");
    var platEl = document.getElementById("checkout-platform");
    var bagEl = document.getElementById("checkout-bag");
    var grandEl = document.getElementById("checkout-grand-total");
    var payEl = document.getElementById("checkout-pay-amount");
    if (subEl) subEl.textContent = formatCheckoutMoney(subtotal);
    if (shipEl) shipEl.textContent = formatCheckoutMoney(shipping);
    if (platEl) platEl.textContent = formatCheckoutMoney(platform);
    if (bagEl) bagEl.textContent = formatCheckoutMoney(bag);
    if (grandEl) grandEl.textContent = formatCheckoutMoney(grand);
    if (payEl) payEl.textContent = formatCheckoutMoney(grand);
  }

  refreshCheckoutModalIfOpen = function () {
    if (checkoutConfirmModal && checkoutConfirmModal.classList.contains("is-open")) {
      populateCheckoutModal();
    }
  };

  function openCheckoutConfirmModal() {
    populateCheckoutModal();
    if (checkoutConfirmModal) {
      checkoutConfirmModal.classList.add("is-open");
      checkoutConfirmModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
  }

  function closeCheckoutConfirmModal() {
    if (checkoutConfirmModal) {
      checkoutConfirmModal.classList.remove("is-open");
      checkoutConfirmModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
  }

  function openCheckoutSuccessPage() {
    var grandEl = document.getElementById("checkout-grand-total");
    var payEl = document.getElementById("checkout-pay-amount");
    var amountText = grandEl ? grandEl.textContent.trim() : "";
    if (!amountText && payEl) amountText = payEl.textContent.trim();
    if (checkoutSuccessTotalEl) checkoutSuccessTotalEl.textContent = amountText || "$0.0";
    closeCheckoutConfirmModal();
    if (checkoutSuccessPage) {
      checkoutSuccessPage.classList.add("is-open");
      checkoutSuccessPage.setAttribute("aria-hidden", "false");
    }
    document.body.style.overflow = "hidden";
    if (checkoutSuccessDone) {
      checkoutSuccessDone.focus();
    }
  }

  function closeCheckoutSuccessPage() {
    if (checkoutSuccessPage) {
      checkoutSuccessPage.classList.remove("is-open");
      checkoutSuccessPage.setAttribute("aria-hidden", "true");
    }
    document.body.style.overflow = "";
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", function () {
      var selected = skuItems.filter(function (item) {
        return !item.disabled && isChecked(item.checkbox);
      });
      if (selected.length === 0) return;
      openCheckoutConfirmModal();
    });
  }
  if (checkoutConfirmBackdrop) {
    checkoutConfirmBackdrop.addEventListener("click", closeCheckoutConfirmModal);
  }
  if (checkoutConfirmClose) {
    checkoutConfirmClose.addEventListener("click", closeCheckoutConfirmModal);
  }
  if (checkoutEditTimeslot) {
    checkoutEditTimeslot.addEventListener("click", function () {
      forceMergeOnTimeslotConfirm = currentDeliveryMode === "3hr";
      openTimeslotModal();
    });
  }
  if (checkoutConfirmProceed) {
    checkoutConfirmProceed.addEventListener("click", function () {
      openCheckoutSuccessPage();
    });
  }
  if (checkoutSuccessDone) {
    checkoutSuccessDone.addEventListener("click", function () {
      closeCheckoutSuccessPage();
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (checkoutSuccessPage && checkoutSuccessPage.classList.contains("is-open")) {
      closeCheckoutSuccessPage();
      return;
    }
    if (checkoutConfirmModal && checkoutConfirmModal.classList.contains("is-open")) {
      closeCheckoutConfirmModal();
    }
  });

  applyDeliveryMode(MODE_MERGE);
  syncAllParentsAndFooter();
})();
