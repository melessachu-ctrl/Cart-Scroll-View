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

  var mergeTimeslotText = document.getElementById("merge-timeslot-text");
  var option3hrTimeslotText = document.getElementById("option-3hr-timeslot-text");
  var timeslotModal = document.getElementById("timeslot-modal");
  var timeslotBackdrop = document.getElementById("timeslot-backdrop");
  var timeslotClose = document.getElementById("timeslot-close");
  var timeslotConfirm = document.getElementById("timeslot-confirm");
  var timeslotPickerRow = document.getElementById("timeslot-picker-row");
  var timeslotPickerViewport = document.getElementById("timeslot-picker-viewport");
  var PICKER_ITEM_HEIGHT = 38;
  var pickerScrollTimer = null;
  var timeslotChangeLoadingTimer = null;

  function showTimeslotChangeLoading() {
    var el = document.getElementById("timeslot-change-loading");
    if (!el) return;
    if (timeslotChangeLoadingTimer) clearTimeout(timeslotChangeLoadingTimer);
    el.removeAttribute("hidden");
    el.setAttribute("aria-hidden", "false");
    timeslotChangeLoadingTimer = setTimeout(function () {
      timeslotChangeLoadingTimer = null;
      el.setAttribute("hidden", "");
      el.setAttribute("aria-hidden", "true");
    }, 1000);
  }

  var modalMode3hr = "3hr";
  var modalModeMerge = "merge";
  var modalMode = modalModeMerge;
  /** 從「3小時送達」點「更改」開啟 modal 時為 true，確認後強制切換為一併送 */
  var forceMergeOnTimeslotConfirm = false;
  var wheelOptions = {
    merge: {
      dates: ["今天", "明天", "後天", "01/04 (星期三)", "02/04 (星期四)", "03/04 (星期五)", "8/4(三)"],
      times: [
        "10:00 - 12:30 (已滿)",
        "12:30 - 15:00 (已滿)",
        "15:00 - 18:00",
        "18:00 - 21:00",
        "21:00 - 23:00",
        "10:00 - 12:30",
        "12:30 - 15:00"
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

  function getPickerOptions() {
    return [
      { mode: "3hr", label: "今日 12:30-3PM", badge: true, date: "今日", time: "12:30 - 15:00" },
      { mode: "merge", label: "明天 10AM-12:30PM", date: "明天", time: "10:00 - 12:30 (已滿)" },
      { mode: "merge", label: "明天 12:30-3PM", date: "明天", time: "12:30 - 15:00 (已滿)" },
      { mode: "merge", label: "明天 3-6PM", date: "明天", time: "15:00 - 18:00" },
      { mode: "merge", label: "明天 6-9PM", date: "明天", time: "18:00 - 21:00" },
      { mode: "merge", label: "明天 9-11PM", date: "明天", time: "21:00 - 23:00" },
      { mode: "merge", label: "8/4(三) 10AM-12:30PM", date: "8/4(三)", time: "10:00 - 12:30" },
      { mode: "merge", label: "8/4(三) 12:30-3PM", date: "8/4(三)", time: "12:30 - 15:00" },
      { mode: "merge", label: "8/4(三) 3-6PM", date: "8/4(三)", time: "15:00 - 18:00" },
      { mode: "merge", label: "8/4(三) 6-9PM", date: "8/4(三)", time: "18:00 - 21:00" },
      { mode: "merge", label: "8/4(三) 9-11PM", date: "8/4(三)", time: "21:00 - 23:00" }
    ];
  }

  /** 與主畫面時段卡、picker 選項一致：採用 getPickerOptions[].label 並去掉空白 */
  function formatSlotDisplayLabel(mode, dateStr, timeStr) {
    var opts = getPickerOptions();
    var i;
    for (i = 0; i < opts.length; i++) {
      var o = opts[i];
      if (o.mode === mode && o.date === dateStr && o.time === timeStr) {
        return o.label.replace(/\s/g, "");
      }
    }
    return buildTimeslotText(dateStr, timeStr);
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

  function syncTimeslotConfirmButtonFromIndex(idx) {
    if (!timeslotConfirm) return;
    var opts = getPickerOptions();
    var o = opts[idx];
    var dis = !!(o && o.mode === "merge" && isOptionDisabled("time", o.time));
    timeslotConfirm.disabled = dis;
    timeslotConfirm.classList.toggle("is-disabled", dis);
    timeslotConfirm.setAttribute("aria-disabled", dis ? "true" : "false");
  }

  function syncTimeslotConfirmButton() {
    syncTimeslotConfirmButtonFromIndex(getCurrentPickerIndex());
  }

  function clampIndex(index, max) {
    if (index < 0) return 0;
    if (index > max) return max;
    return index;
  }

  function getCurrentPickerIndex() {
    if (!timeslotPickerViewport) return 0;
    var opts = getPickerOptions();
    var raw = Math.round(timeslotPickerViewport.scrollTop / PICKER_ITEM_HEIGHT);
    return clampIndex(raw, opts.length - 1);
  }

  function applyDraftFromPickerIndex(index) {
    var opts = getPickerOptions();
    var o = opts[index];
    if (!o) return;
    if (o.mode === "3hr") {
      draftByMode["3hr"] = { date: o.date, time: o.time };
      modalMode = modalMode3hr;
    } else {
      draftByMode.merge = { date: o.date, time: o.time };
      modalMode = modalModeMerge;
    }
  }

  function updatePickerItemVisuals(activeIndex) {
    if (!timeslotPickerRow) return;
    var items = timeslotPickerRow.querySelectorAll(".timeslot-picker__item");
    Array.prototype.forEach.call(items, function (btn, i) {
      var dist = Math.abs(i - activeIndex);
      var opacity = 1;
      if (dist === 1) opacity = 0.72;
      else if (dist === 2) opacity = 0.5;
      else if (dist >= 3) opacity = 0.32;
      btn.style.opacity = String(opacity);
      btn.classList.toggle("is-active", i === activeIndex);
    });
  }

  function findPickerIndexForDraft() {
    var opts = getPickerOptions();
    var i;
    var hr3Selected = document.querySelector(".delivery-slot-card--3hr.is-selected");
    if (hr3Selected) {
      for (i = 0; i < opts.length; i++) {
        var o3 = opts[i];
        if (o3.mode === "3hr" && draftByMode["3hr"].date === o3.date && draftByMode["3hr"].time === o3.time) {
          return i;
        }
      }
      return 0;
    }
    var mergeCard = document.querySelector(".delivery-slot-card--merge.is-selected");
    if (mergeCard) {
      var d = mergeCard.getAttribute("data-merge-date");
      var t = mergeCard.getAttribute("data-merge-time");
      for (i = 0; i < opts.length; i++) {
        var om = opts[i];
        if (om.mode === "merge" && om.date === d && om.time === t) return i;
      }
    }
    for (i = 0; i < opts.length; i++) {
      var o = opts[i];
      if (o.mode === "3hr" && draftByMode["3hr"].date === o.date && draftByMode["3hr"].time === o.time) return i;
    }
    for (i = 0; i < opts.length; i++) {
      var o2 = opts[i];
      if (o2.mode === "merge" && draftByMode.merge.date === o2.date && draftByMode.merge.time === o2.time) return i;
    }
    for (i = 0; i < opts.length; i++) {
      if (opts[i].mode === "merge" && opts[i].time === "15:00 - 18:00") return i;
    }
    return 0;
  }

  function snapPicker(smooth) {
    if (!timeslotPickerViewport || !timeslotPickerRow) return;
    var opts = getPickerOptions();
    var raw = Math.round(timeslotPickerViewport.scrollTop / PICKER_ITEM_HEIGHT);
    var idx = clampIndex(raw, opts.length - 1);
    var targetTop = idx * PICKER_ITEM_HEIGHT;
    if (Math.abs(timeslotPickerViewport.scrollTop - targetTop) > 0.5) {
      timeslotPickerViewport.scrollTo({ top: targetTop, behavior: smooth ? "smooth" : "auto" });
    }
    applyDraftFromPickerIndex(idx);
    updatePickerItemVisuals(idx);
    syncTimeslotConfirmButtonFromIndex(idx);
  }

  function bindPickerScroll() {
    if (!timeslotPickerViewport) return;
    timeslotPickerViewport.addEventListener("scroll", function () {
      clearTimeout(pickerScrollTimer);
      pickerScrollTimer = setTimeout(function () {
        snapPicker(true);
      }, 80);
    });
  }

  function renderPicker() {
    if (!timeslotPickerRow || !timeslotPickerViewport) return;
    ensureMergeDraftDateValid();
    normalizeDraftTimeIfMissing("merge");
    normalizeDraftTimeIfMissing("3hr");
    timeslotPickerRow.innerHTML = "";
    var opts = getPickerOptions();
    var badgeSvg =
      '<svg class="timeslot-picker__badge-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="#fff"/>' +
      "</svg>";

    opts.forEach(function (o, index) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "timeslot-picker__item";
      btn.dataset.index = String(index);
      if (o.mode === "3hr") {
        btn.classList.add("timeslot-picker__item--3hr");
        var badge = document.createElement("span");
        badge.className = "timeslot-picker__badge";
        badge.innerHTML = badgeSvg + "<span>3小時送達</span>";
        var lab = document.createElement("span");
        lab.className = "timeslot-picker__label";
        lab.textContent = o.label;
        btn.appendChild(badge);
        btn.appendChild(lab);
      } else {
        var lab2 = document.createElement("span");
        lab2.className = "timeslot-picker__label";
        var mergeDis = o.mode === "merge" && isOptionDisabled("time", o.time);
        lab2.textContent = mergeDis ? o.label + "（已滿）" : o.label;
        btn.appendChild(lab2);
      }
      if (o.mode === "merge" && isOptionDisabled("time", o.time)) {
        btn.classList.add("timeslot-picker__item--disabled");
      }
      btn.addEventListener("click", function () {
        timeslotPickerViewport.scrollTo({ top: index * PICKER_ITEM_HEIGHT, behavior: "smooth" });
        setTimeout(function () {
          snapPicker(false);
        }, 280);
      });
      timeslotPickerRow.appendChild(btn);
    });

    requestAnimationFrame(function () {
      var idx = findPickerIndexForDraft();
      timeslotPickerViewport.scrollTop = idx * PICKER_ITEM_HEIGHT;
      snapPicker(false);
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
    renderPicker();
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
    var checkoutSkuSnapshot = takeCheckoutSkuSnapshotIfModalOpen();
    var idx = getCurrentPickerIndex();
    applyDraftFromPickerIndex(idx);
    var opts = getPickerOptions();
    var o = opts[idx];
    if (!o) return false;
    if (o.mode === "merge" && isOptionDisabled("time", o.time)) return false;
    selectedByMode.merge = { date: draftByMode.merge.date, time: draftByMode.merge.time };
    selectedByMode["3hr"] = { date: draftByMode["3hr"].date, time: draftByMode["3hr"].time };
    if (mergeTimeslotText) {
      mergeTimeslotText.textContent = formatSlotDisplayLabel("merge", selectedByMode.merge.date, selectedByMode.merge.time);
    }
    if (option3hrTimeslotText) {
      option3hrTimeslotText.textContent = formatSlotDisplayLabel("3hr", selectedByMode["3hr"].date, selectedByMode["3hr"].time);
    }
    if (forceMergeOnTimeslotConfirm) {
      applyDeliveryMode(MODE_MERGE);
      forceMergeOnTimeslotConfirm = false;
    } else {
      applyDeliveryMode(modalMode === modalMode3hr ? MODE_3HR_ONLY : MODE_MERGE);
    }
    syncAllParentsAndFooter();
    updateCheckoutSkuWarningAfterTimeslotChange(checkoutSkuSnapshot);
    refreshCheckoutModalIfOpen();
    return true;
  }

  if (timeslotBackdrop) {
    timeslotBackdrop.addEventListener("click", closeTimeslotModal);
  }
  if (timeslotClose) {
    timeslotClose.addEventListener("click", closeTimeslotModal);
  }
  if (timeslotConfirm) {
    timeslotConfirm.addEventListener("click", function () {
      if (timeslotConfirm.disabled) return;
      var was3hrOnly = currentDeliveryMode === MODE_3HR_ONLY;
      var forcingMergeOnConfirm = forceMergeOnTimeslotConfirm;
      var willBe3hrOnly = forcingMergeOnConfirm ? false : modalMode === modalMode3hr;
      var crosses3hrBoundary = was3hrOnly !== willBe3hrOnly;
      var applied = applyTimeslotSelection();
      closeTimeslotModal();
      if (applied && crosses3hrBoundary) showTimeslotChangeLoading();
    });
  }
  bindPickerScroll();
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
  var deliverySlotScroll = document.querySelector(".delivery-slot-scroll");
  var deliverySlotScrollCenteredOnce = false;
  var btnAllTimeslots = document.getElementById("btn-all-timeslots");
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

  function scrollSelectedDeliverySlotIntoView() {
    if (!deliverySlotScroll) return;
    var selected = deliverySlotScroll.querySelector(".delivery-slot-card.is-selected");
    if (!selected) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var behavior = deliverySlotScrollCenteredOnce ? "smooth" : "auto";
        selected.scrollIntoView({
          behavior: behavior,
          inline: "center",
          block: "nearest"
        });
        deliverySlotScrollCenteredOnce = true;
      });
    });
  }

  function syncDeliverySlotUi() {
    var hr3 = document.querySelector(".delivery-slot-card--3hr");
    var mergeCards = document.querySelectorAll(".delivery-slot-card--merge");
    if (hr3) {
      hr3.classList.toggle("is-selected", currentDeliveryMode === MODE_3HR_ONLY);
      hr3.setAttribute("aria-checked", currentDeliveryMode === MODE_3HR_ONLY ? "true" : "false");
    }
    mergeCards.forEach(function (c) {
      c.classList.remove("is-selected");
      c.setAttribute("aria-checked", "false");
    });
    if (currentDeliveryMode === MODE_MERGE) {
      var d = selectedByMode.merge.date;
      var t = selectedByMode.merge.time;
      mergeCards.forEach(function (c) {
        if (c.getAttribute("data-merge-date") === d && c.getAttribute("data-merge-time") === t) {
          c.classList.add("is-selected");
          c.setAttribute("aria-checked", "true");
        }
      });
    }
    scrollSelectedDeliverySlotIntoView();
  }

  function applyDeliveryMode(mode) {
    currentDeliveryMode = mode;
    var muted = mode === MODE_3HR_ONLY;
    if (deliverySub8) deliverySub8.classList.toggle("is-delivery-muted", muted);
    if (deliverySubTmr) deliverySubTmr.classList.toggle("is-delivery-muted", muted);

    if (mode === MODE_3HR_ONLY) {
      skuItems.forEach(function (item) {
        if (!isHktSku(item)) return;
        if (isHkt3hrSku(item)) {
          setSkuDisabled(item, false);
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
    syncDeliverySlotUi();
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

  function takeCheckoutSkuSnapshotIfModalOpen() {
    var coEl = document.getElementById("checkout-confirm-modal");
    if (!coEl || !coEl.classList.contains("is-open")) return null;
    return skuItems.filter(function (item) {
      return !item.disabled && isChecked(item.checkbox);
    });
  }

  function updateCheckoutSkuWarningAfterTimeslotChange(snapshot) {
    var el = document.getElementById("checkout-timeslot-sku-warning");
    if (!el) return;
    if (!snapshot || snapshot.length === 0) {
      el.setAttribute("hidden", "");
      el.setAttribute("aria-hidden", "true");
      return;
    }
    var lost = false;
    var i;
    for (i = 0; i < snapshot.length; i++) {
      var it = snapshot[i];
      if (it.disabled || !isChecked(it.checkbox)) {
        lost = true;
        break;
      }
    }
    if (lost) {
      el.removeAttribute("hidden");
      el.setAttribute("aria-hidden", "false");
    } else {
      el.setAttribute("hidden", "");
      el.setAttribute("aria-hidden", "true");
    }
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

  if (btnAllTimeslots) {
    btnAllTimeslots.addEventListener("click", function () {
      forceMergeOnTimeslotConfirm = currentDeliveryMode === MODE_3HR_ONLY;
      openTimeslotModal();
    });
  }

  if (deliverySlotScroll) {
    deliverySlotScroll.addEventListener("click", function (event) {
      var mergeCard = event.target.closest(".delivery-slot-card--merge");
      if (mergeCard) {
        var checkoutSkuSnapshotMerge = takeCheckoutSkuSnapshotIfModalOpen();
        var was3hrBeforeMergeCard = currentDeliveryMode === MODE_3HR_ONLY;
        var md = mergeCard.getAttribute("data-merge-date");
        var mt = mergeCard.getAttribute("data-merge-time");
        if (md && mt) {
          selectedByMode.merge = { date: md, time: mt };
          if (mergeTimeslotText) {
            mergeTimeslotText.textContent = formatSlotDisplayLabel("merge", md, mt);
          }
        }
        applyDeliveryMode(MODE_MERGE);
        syncAllParentsAndFooter();
        updateCheckoutSkuWarningAfterTimeslotChange(checkoutSkuSnapshotMerge);
        refreshCheckoutModalIfOpen();
        if (was3hrBeforeMergeCard) showTimeslotChangeLoading();
        return;
      }
      if (event.target.closest(".delivery-slot-card--3hr")) {
        var checkoutSkuSnapshot3hr = takeCheckoutSkuSnapshotIfModalOpen();
        var wasAlready3hrOnly = currentDeliveryMode === MODE_3HR_ONLY;
        applyDeliveryMode(MODE_3HR_ONLY);
        syncAllParentsAndFooter();
        updateCheckoutSkuWarningAfterTimeslotChange(checkoutSkuSnapshot3hr);
        refreshCheckoutModalIfOpen();
        if (!wasAlready3hrOnly) showTimeslotChangeLoading();
      }
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
    updateCheckoutSkuWarningAfterTimeslotChange(null);
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
