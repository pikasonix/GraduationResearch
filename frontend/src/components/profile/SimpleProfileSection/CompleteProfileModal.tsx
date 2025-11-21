import React, { useEffect } from "react";
import { useForm, ControllerRenderProps } from "react-hook-form";
import ScrollableModal from "@/components/common/ScrollableModal";
import { DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import FileUpload from "@/components/common/FileUpload";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectRadioContent,
  SelectRadioItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import {
  PROFILE_TYPE_OPTIONS,
  PROFILE_ROLE_OPTIONS,
} from "@/lib/constants/options";

// Define the structure for the profile data this modal edits
export interface ProfileData {
  avatarFile?: File | null; // Hold the selected file object
  avatarUrl?: string | null; // Existing URL for display
  name: string;
  phone: string;
  type: string; // Changed from string[] to string
  role: string[]; // e.g., ['CEO', 'Designer']
}

interface CompleteProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: Omit<ProfileData, "avatarFile" | "type"> & {
    type?: string | string[];
  }; // Allow initial type to be string or array
  onSave: (updatedData: ProfileData) => void;
}

const sanitizePhoneInput = (input = "") => {
  const s = input.replace(/[^\d+]/g, "");
  return s.startsWith("+") ? "+" + s.slice(1).replace(/\+/g, "") : s.replace(/\+/g, "");
};

const isValidPhone = (value?: string) => {
  if (!value) return false;
  const normalized = (value || "").replace(/[^\d]/g, "");
  const re = /^(?:(?:0|84)(?:3|5|7|8|9)\d{8}|(?:0|84)2\d{9})$/;
  return re.test(normalized);
};

const getValidInitialType = (
  initialType: string | string[] | undefined
): string => {
  let typeToValidate: string | undefined = undefined;
  if (Array.isArray(initialType) && initialType.length > 0) {
    typeToValidate = initialType[0];
  } else if (typeof initialType === "string") {
    typeToValidate = initialType;
  }

  if (
    typeToValidate &&
    PROFILE_TYPE_OPTIONS.some((option) => option.value === typeToValidate)
  ) {
    return typeToValidate;
  }
  return ""; // Default to empty string if not valid or not provided
};

/**
 * Modal for completing/editing the main user profile details, using shadcn/ui.
 *
 * @param {CompleteProfileModalProps} props Component props.
 * @returns {JSX.Element} The complete profile modal.
 */
const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
}) => {
  // Initialize react-hook-form
  const form = useForm<ProfileData>({
    mode: "onChange",
    defaultValues: {
      ...initialData,
      type: getValidInitialType(initialData.type),
      avatarFile: null,
    },
  });

  // Reset form when initialData changes or modal opens
  useEffect(() => {
    if (isOpen) {
      form.reset({
        ...initialData,
        type: getValidInitialType(initialData.type),
        avatarFile: null,
      });
    }
  }, [isOpen, initialData, form]);

  // Submit handler
  const onSubmit = (data: ProfileData) => {
    console.log("Form Data Submitted:", data);
    onSave(data); // Pass data to the original onSave handler
    onClose(); // Close modal after save
  };

  const modalTitle = (
    <>
      <div className="font-semibold">Hoàn thành hồ sơ của bạn</div>
      <DialogDescription className="pt-1">
        Chọn tên người dùng và vai trò của bạn.
      </DialogDescription>
    </>
  );

  const modalFooter = (
    <DialogFooter>
      <Button variant="outline" type="button" onClick={onClose}>
        Hủy
      </Button>
      <Button
        type="submit"
        disabled={!form.formState.isValid}
        onClick={form.handleSubmit(onSubmit)}
      >
        Xong
      </Button>
    </DialogFooter>
  );

  return (
    <ScrollableModal
      open={isOpen}
      onOpenChange={onClose}
      title={modalTitle}
      footer={modalFooter}
      maxWidth="sm:max-w-[480px]"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-1">
          <FormField
            control={form.control}
            name="avatarUrl"
            render={({
              field,
            }: {
              field: ControllerRenderProps<ProfileData, "avatarUrl">;
            }) => (
              <FormItem>
                <FormControl>
                  <FileUpload
                    label="Ảnh đại diện"
                    onFileSelect={(file) => {
                      form.setValue("avatarFile", file, { shouldDirty: true });
                    }}
                    currentImageUrl={field.value}
                    accept="image/png, image/jpeg, image/svg+xml"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            rules={{ required: "Tên người dùng là bắt buộc." }}
            render={({
              field,
            }: {
              field: ControllerRenderProps<ProfileData, "name">;
            }) => (
              <FormItem>
                <FormLabel className="mx-1">Tên người dùng*</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Nhập tên người dùng của bạn"
                    {...field}
                    className="w-full m-0 h-12 px-3 py-2.5 border border-gray-200 rounded-md focus-visible:ring-2 focus-visible:ring-sky-300"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            rules={{
              required: "Số điện thoại là bắt buộc.",
              validate: (value: string) =>
                isValidPhone(value) ||
                "Vui lòng nhập số điện thoại hợp lệ.",
            }}
            render={({
              field,
            }: {
              field: ControllerRenderProps<ProfileData, "phone">;
            }) => (
              <FormItem>
                <FormLabel className="mx-1">Số điện thoại*</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Nhập số điện thoại của bạn"
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const sanitized = sanitizePhoneInput(e.target.value);
                      field.onChange(sanitized);
                    }}
                    inputMode="tel"
                    className="w-full m-0 h-12 px-3 py-2.5 border border-gray-200 rounded-md focus-visible:ring-2 focus-visible:ring-sky-300"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            rules={{ required: "Phân loại hồ sơ là bắt buộc." }}
            render={({
              field,
            }: {
              field: ControllerRenderProps<ProfileData, "type">;
            }) => (
              <FormItem>
                <FormLabel>Phân Loại*</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value)}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger showTag={true} onClear={() => field.onChange("")}>
                      <SelectValue placeholder="Chọn loại hồ sơ" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectRadioContent>
                    {PROFILE_TYPE_OPTIONS.map((option) => (
                      <SelectRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectRadioItem>
                    ))}
                  </SelectRadioContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </ScrollableModal>
  );
};

export default CompleteProfileModal;