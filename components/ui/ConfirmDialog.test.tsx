import { describe, expect, it } from "vitest";
import { confirmDialogLabels } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("keeps cancel and danger labels explicit", () => {
    expect(confirmDialogLabels("删除闪念", "取消")).toEqual({ confirmLabel: "删除闪念", cancelLabel: "取消" });
  });
});
