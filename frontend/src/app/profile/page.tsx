"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useGetSessionQuery } from "@/lib/redux/services/auth";
import {
  useGetUserProfileOverviewQuery,
  useUpdateUserMutation,
  useUploadAvatarMutation,
  useLazyCheckUsernameQuery,
  useUpdateOrganizationMutation,
  type UserRole,
} from "@/lib/redux/services/userApi";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FileUpload from "@/components/common/FileUpload";
import { Avatar } from "@/components/common/Avatar";
import { getAvatarUrl } from "@/lib/utils/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { User, Building2, Phone, Mail, Shield, Pencil, Briefcase, Truck } from "lucide-react";
import { getGeocoder } from "@/services/geocoding";
import { UniversalMap } from "@/components/map/UniversalMap";
import { HomePinIcon } from "@/components/icon";

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Quản trị viên",
  manager: "Quản lý",
  driver: "Tài xế",
  user: "Người dùng",
};

const roleBadgeColors: Record<UserRole, string> = {
  super_admin: "bg-red-100 text-red-800",
  admin: "bg-purple-100 text-purple-800",
  manager: "bg-blue-100 text-blue-800",
  driver: "bg-yellow-100 text-yellow-800",
  user: "bg-gray-100 text-gray-800",
};

const LoadingSpinner: React.FC = () => (
  <div className="flex justify-center items-center h-64">
    <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => (
  <div className="text-center text-red-600 py-10">
    <p>Error loading data: {message}</p>
    <p>Please try refreshing the page.</p>
  </div>
);

type RtkQueryError = FetchBaseQueryError & {
  data?: string | { message?: string };
};

interface EditProfileForm {
  full_name: string;
  phone: string;
  username: string;
  avatarFile?: File | null;
}

interface EditDepotForm {
  depot_name: string;
  depot_address: string;
  depot_latitude: string;
  depot_longitude: string;
}

const ProfilePage: React.FC = () => {
  const { data: sessionData, isLoading: isLoadingSession } = useGetSessionQuery();
  const router = useRouter();
  const userId = sessionData?.session?.user?.id;

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditProfileForm>({
    full_name: "",
    phone: "",
    username: "",
  });
  const [usernameCheckStatus, setUsernameCheckStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: "" });

  const {
    data: overviewData,
    error: overviewError,
    isLoading: isLoadingOverview,
    isFetching: isFetchingOverview,
  } = useGetUserProfileOverviewQuery(userId ?? "", {
    skip: !userId,
  });

  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [updateOrganization, { isLoading: isUpdatingOrg }] = useUpdateOrganizationMutation();
  const [uploadAvatar] = useUploadAvatarMutation();
  const [checkUsername] = useLazyCheckUsernameQuery();

  const user = overviewData?.user ?? null;
  const organization = overviewData?.organization ?? null;

  const [isDepotModalOpen, setIsDepotModalOpen] = useState(false);
  const [depotForm, setDepotForm] = useState<EditDepotForm>({
    depot_name: "",
    depot_address: "",
    depot_latitude: "",
    depot_longitude: "",
  });
  const [isGeocodingDepot, setIsGeocodingDepot] = useState(false);

  const handleMutationError = useCallback((err: unknown, context: string) => {
    console.error(`Failed to ${context}:`, err);
    let message = `Could not ${context}.`;
    if (typeof err === "object" && err !== null && ("status" in err || "error" in err)) {
      const rtkError = err as RtkQueryError;
      if (typeof rtkError.data === "string") {
        message = rtkError.data;
      } else if (typeof rtkError.data === "object" && rtkError.data?.message) {
        message = rtkError.data.message;
      } else if ("error" in rtkError && typeof rtkError.error === "string") {
        message = rtkError.error;
      }
    }
    toast.error(`Error: ${message}`);
  }, []);

  const isLoading = isLoadingSession || isLoadingOverview || isFetchingOverview;

  // Debounced username check
  useEffect(() => {
    if (!userId || !editForm.username || editForm.username === user?.username) {
      setUsernameCheckStatus({ checking: false, available: null, message: "" });
      return;
    }

    setUsernameCheckStatus({ checking: true, available: null, message: "" });

    const timeoutId = setTimeout(async () => {
      try {
        const result = await checkUsername({
          username: editForm.username,
          currentUserId: userId,
        }).unwrap();

        if (result.available) {
          setUsernameCheckStatus({
            checking: false,
            available: true,
            message: "Username khả dụng",
          });
        } else {
          setUsernameCheckStatus({
            checking: false,
            available: false,
            message: "Username đã tồn tại",
          });
        }
      } catch {
        setUsernameCheckStatus({
          checking: false,
          available: null,
          message: "Lỗi kiểm tra username",
        });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [editForm.username, userId, user?.username, checkUsername]);

  // Check for missing role
  useEffect(() => {
    if (user && (!user.role || user.role === "user")) {
      setIsRoleModalOpen(true);
    } else {
      setIsRoleModalOpen(false);
    }
  }, [user]);

  const handleRoleSelect = async (role: UserRole) => {
    if (!userId) return;
    try {
      await updateUser({
        id: userId,
        role: role
      }).unwrap();
      toast.success("Cập nhật vai trò thành công!");
      setIsRoleModalOpen(false);
    } catch (err) {
      handleMutationError(err, "update role");
    }
  };

  useEffect(() => {
    if (!isLoadingSession && !userId) {
      router.push("/login");
    }
  }, [isLoadingSession, userId, router]);

  // ...



  useEffect(() => {
    if (user) {
      setEditForm({
        full_name: user.full_name || "",
        phone: user.phone || "",
        username: user.username || "",
      });
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="pt-16 sm:pt-20 md:pt-24 max-w-4xl mx-auto px-4">
        <LoadingSpinner />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="pt-16 sm:pt-20 md:pt-24 max-w-4xl mx-auto px-4 text-center">
        Authenticating... If this persists, please{" "}
        <a href="/login" className="underline">log in</a>.
      </div>
    );
  }

  if (overviewError) {
    const errorMessage =
      typeof overviewError === "object" && overviewError && "data" in overviewError
        ? String(overviewError.data)
        : "An unknown error occurred";
    return (
      <div className="pt-16 sm:pt-20 md:pt-24 max-w-4xl mx-auto px-4">
        <ErrorDisplay message={errorMessage} />
      </div>
    );
  }

  const handleEditProfile = () => {
    if (user) {
      setEditForm({
        full_name: user.full_name || "",
        phone: user.phone || "",
        username: user.username || "",
      });
    }
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!userId) return;

    // Kiểm tra username trước khi lưu
    if (usernameCheckStatus.available === false) {
      toast.error("Vui lòng chọn username khác");
      return;
    }

    try {
      let avatarUrl = user?.avatar_url;

      // Upload avatar if a file was selected
      if (editForm.avatarFile) {
        const uploadResult = await uploadAvatar({
          file: editForm.avatarFile,
          userId,
        }).unwrap();
        avatarUrl = uploadResult.publicUrl;
      }

      // Update user profile
      await updateUser({
        id: userId,
        full_name: editForm.full_name,
        phone: editForm.phone,
        username: editForm.username,
        avatar_url: avatarUrl,
      }).unwrap();

      toast.success("Cập nhật thông tin thành công!");
      setIsEditModalOpen(false);
    } catch (err) {
      handleMutationError(err, "update profile");
    }
  };

  const handleEditDepot = () => {
    setDepotForm({
      depot_name: organization?.depot_name || "",
      depot_address: organization?.depot_address || "",
      depot_latitude:
        organization?.depot_latitude === null || organization?.depot_latitude === undefined
          ? ""
          : String(organization.depot_latitude),
      depot_longitude:
        organization?.depot_longitude === null || organization?.depot_longitude === undefined
          ? ""
          : String(organization.depot_longitude),
    });
    setIsDepotModalOpen(true);
  };

  const handleGeocodeDepot = async () => {
    const query = depotForm.depot_address.trim();
    if (!query) {
      toast.error("Vui lòng nhập địa chỉ depot trước");
      return;
    }
    setIsGeocodingDepot(true);
    try {
      const geocoder = getGeocoder();
      const result = await geocoder.geocode(query);
      if (!result) {
        toast.error("Không tìm thấy tọa độ cho địa chỉ này");
        return;
      }
      const [lng, lat] = result.center;
      setDepotForm((prev) => ({
        ...prev,
        depot_address: result.place_name || prev.depot_address,
        depot_latitude: String(lat),
        depot_longitude: String(lng),
      }));
      toast.success("Đã lấy tọa độ depot");
    } catch (err) {
      console.error("Failed to geocode depot:", err);
      toast.error("Lỗi khi lấy tọa độ depot");
    } finally {
      setIsGeocodingDepot(false);
    }
  };

  const handleDepotMapPick = async (lat: number, lng: number) => {
    setDepotForm((prev) => ({
      ...prev,
      depot_latitude: String(lat),
      depot_longitude: String(lng),
    }));

    try {
      const geocoder = getGeocoder();
      if (typeof geocoder.reverse === "function") {
        const addr = await geocoder.reverse(lng, lat);
        if (addr) {
          setDepotForm((prev) => ({
            ...prev,
            depot_address: prev.depot_address?.trim() ? prev.depot_address : addr,
          }));
        }
      }
    } catch (e) {
      console.warn("Depot reverse-geocode failed", e);
    }
  };

  const handleSaveDepot = async () => {
    if (!organization?.id) {
      toast.error("Không tìm thấy tổ chức để cập nhật depot");
      return;
    }

    const depotName = depotForm.depot_name.trim() || null;
    const depotAddress = depotForm.depot_address.trim() || null;

    const latStr = depotForm.depot_latitude.trim();
    const lngStr = depotForm.depot_longitude.trim();
    const lat = latStr ? Number(latStr) : null;
    const lng = lngStr ? Number(lngStr) : null;

    if ((latStr || lngStr) && (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng))) {
      toast.error("Tọa độ depot không hợp lệ");
      return;
    }

    try {
      await updateOrganization({
        id: organization.id,
        depot_name: depotName,
        depot_address: depotAddress,
        depot_latitude: lat,
        depot_longitude: lng,
      }).unwrap();
      toast.success("Đã cập nhật depot");
      setIsDepotModalOpen(false);
    } catch (err) {
      handleMutationError(err, "update depot");
    }
  };

  return (
    <div className="flex flex-col min-h-screen pt-16">
      <Toaster />
      {isFetchingOverview && (
        <div className="fixed top-4 right-4 z-50 bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm">
          Đang cập nhật...
        </div>
      )}

      <main className="flex-grow container max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Thông tin tài khoản</h1>

        {/* User Info Card */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Thông tin cá nhân
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleEditProfile}>
              <Pencil className="h-4 w-4 mr-2" />
              Chỉnh sửa
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <Avatar
                src={getAvatarUrl(user?.avatar_url, sessionData?.session?.user?.user_metadata?.avatar_url)}
                name={user?.full_name}
                size={80}
                className="border-2 border-gray-200"
              />
              <div>
                <p className="font-semibold text-lg">{user?.full_name || "Chưa cập nhật"}</p>
                <p className="text-sm text-muted-foreground">@{user?.username || "Chưa cập nhật"}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-sm flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email
                </Label>
                <p className="font-medium">{user?.email || "Chưa cập nhật"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Số điện thoại
                </Label>
                <p className="font-medium">{user?.phone || "Chưa cập nhật"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Vai trò
                </Label>
                <div className="mt-1">
                  {user?.role && (
                    <Badge className={roleBadgeColors[user.role]}>
                      {roleLabels[user.role]}
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Trạng thái</Label>
                <div className="mt-1">
                  <Badge variant={user?.is_active ? "default" : "secondary"}>
                    {user?.is_active ? "Đang hoạt động" : "Không hoạt động"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organization Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Thông tin tổ chức
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-sm">Tên tổ chức</Label>
                <p className="font-medium">{organization?.name || "Chưa cập nhật"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Loại tài khoản</Label>
                <div className="mt-1">
                  <Badge variant="outline">
                    {organization?.account_type === "enterprise" ? "Doanh nghiệp" : "Cá nhân"}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Email liên hệ</Label>
                <p className="font-medium">{organization?.contact_email || "Chưa cập nhật"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">SĐT liên hệ</Label>
                <p className="font-medium">{organization?.contact_phone || "Chưa cập nhật"}</p>
              </div>
              {organization?.address && (
                <div className="md:col-span-2">
                  <Label className="text-muted-foreground text-sm">Địa chỉ</Label>
                  <p className="font-medium">{organization.address}</p>
                </div>
              )}
              {organization?.tax_code && (
                <div>
                  <Label className="text-muted-foreground text-sm">Mã số thuế</Label>
                  <p className="font-medium">{organization.tax_code}</p>
                </div>
              )}

              <div className="md:col-span-2 border-t pt-4">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-muted-foreground text-sm flex items-center gap-2">
                    <HomePinIcon width={16} height={16} />
                    Depot (kho xuất phát)
                  </Label>
                  <Button variant="outline" size="sm" onClick={handleEditDepot}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Nhập depot
                  </Button>
                </div>

                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-muted-foreground text-xs">Tên depot</Label>
                    <p className="font-medium">{organization?.depot_name || "Chưa cập nhật"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Tọa độ</Label>
                    <p className="font-medium">
                      {organization?.depot_latitude != null && organization?.depot_longitude != null
                        ? `${organization.depot_latitude}, ${organization.depot_longitude}`
                        : "Chưa cập nhật"}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-muted-foreground text-xs">Địa chỉ depot</Label>
                    <p className="font-medium">{organization?.depot_address || "Chưa cập nhật"}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Edit Profile Modal */}
      {/* Edit Profile Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa thông tin cá nhân</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 flex-1 overflow-y-auto px-1">
            <FileUpload
              label="Ảnh đại diện"
              onFileSelect={(file) => setEditForm({ ...editForm, avatarFile: file })}
              currentImageUrl={getAvatarUrl(user?.avatar_url, sessionData?.session?.user?.user_metadata?.avatar_url)}
              accept="image/png, image/jpeg, image/jpg"
            />
            
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Họ và tên</Label>
              <Input
                id="full_name"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                placeholder="Nhập họ và tên"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <Input
                  id="username"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  placeholder="Nhập username"
                  className={
                    usernameCheckStatus.available === false
                      ? "border-red-500 focus-visible:ring-red-500"
                      : usernameCheckStatus.available === true
                      ? "border-green-500 focus-visible:ring-green-500"
                      : ""
                  }
                />
                {usernameCheckStatus.checking && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {usernameCheckStatus.message && (
                <p
                  className={`text-xs mt-1 ${
                    usernameCheckStatus.available === false
                      ? "text-red-600"
                      : usernameCheckStatus.available === true
                      ? "text-green-600"
                      : "text-gray-500"
                  }`}
                >
                  {usernameCheckStatus.message}
                </p>
              )}
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="Nhập số điện thoại"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={isUpdating || usernameCheckStatus.available === false || usernameCheckStatus.checking}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Depot Modal */}
      <Dialog open={isDepotModalOpen} onOpenChange={setIsDepotModalOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Nhập depot (kho xuất phát)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 flex-1 overflow-y-auto px-1">
            <div className="space-y-1.5">
              <Label htmlFor="depot_name">Tên depot</Label>
              <Input
                id="depot_name"
                value={depotForm.depot_name}
                onChange={(e) => setDepotForm({ ...depotForm, depot_name: e.target.value })}
                placeholder="VD: Kho chính"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="depot_address">Địa chỉ depot</Label>
              <Input
                id="depot_address"
                value={depotForm.depot_address}
                onChange={(e) => setDepotForm({ ...depotForm, depot_address: e.target.value })}
                placeholder="Nhập địa chỉ depot"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeocodeDepot}
                  disabled={isGeocodingDepot}
                >
                  {isGeocodingDepot ? "Đang lấy tọa độ..." : "Lấy tọa độ từ địa chỉ"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="depot_latitude">Vĩ độ (lat)</Label>
                <Input
                  id="depot_latitude"
                  value={depotForm.depot_latitude}
                  onChange={(e) => setDepotForm({ ...depotForm, depot_latitude: e.target.value })}
                  placeholder="21.0..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="depot_longitude">Kinh độ (lng)</Label>
                <Input
                  id="depot_longitude"
                  value={depotForm.depot_longitude}
                  onChange={(e) => setDepotForm({ ...depotForm, depot_longitude: e.target.value })}
                  placeholder="105.8..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm flex items-center gap-2">
                <HomePinIcon width={16} height={16} />
                Chọn depot trên bản đồ
              </Label>
              <div className="w-full h-[280px] rounded-md overflow-hidden border">
                <UniversalMap
                  interactive
                  height="280px"
                  center={
                    depotForm.depot_longitude.trim() && depotForm.depot_latitude.trim()
                      ? ([Number(depotForm.depot_longitude), Number(depotForm.depot_latitude)] as [number, number])
                      : ([105.8342, 21.0278] as [number, number])
                  }
                  zoom={
                    depotForm.depot_longitude.trim() && depotForm.depot_latitude.trim()
                      ? 14
                      : 12
                  }
                  pendingMarker={
                    depotForm.depot_longitude.trim() && depotForm.depot_latitude.trim()
                      ? { lat: Number(depotForm.depot_latitude), lng: Number(depotForm.depot_longitude) }
                      : null
                  }
                  onMapClick={(lat, lng) => {
                    // click to set depot
                    handleDepotMapPick(lat, lng);
                  }}
                  showOrderLines={false}
                  showPairLines={false}
                />
              </div>
              <p className="text-xs text-muted-foreground">Click lên bản đồ để đặt vị trí depot.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDepotModalOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleSaveDepot}
              disabled={isUpdatingOrg}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdatingOrg ? "Đang lưu..." : "Lưu depot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Selection Modal */}
      <Dialog open={isRoleModalOpen} onOpenChange={(open) => {
        // Prevent closing if user has no role or is 'user'
        if ((!user?.role || user?.role === "user") && !open) return;
        setIsRoleModalOpen(open);
      }}>
        <DialogContent className="sm:max-w-md [&>button]:hidden text-center justify-center items-center flex flex-col" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader className="items-center">
            <DialogTitle className="text-xl">Chọn vai trò của bạn</DialogTitle>
            <div className="text-sm text-muted-foreground">
              Vui lòng chọn vai trò để tiếp tục sử dụng hệ thống
            </div>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4 w-full">
            <button
              onClick={() => handleRoleSelect("manager")}
              className="flex flex-col items-center justify-center p-4 border-2 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all gap-3 group"
              disabled={isUpdating}
            >
              <div className="p-3 rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <Briefcase size={24} />
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-900">Quản lý</div>
                <div className="text-xs text-gray-500 mt-1">Quản lý đội xe và đơn hàng</div>
              </div>
            </button>

            <button
              onClick={() => handleRoleSelect("driver")}
              className="flex flex-col items-center justify-center p-4 border-2 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all gap-3 group"
              disabled={isUpdating}
            >
              <div className="p-3 rounded-full bg-green-100 text-green-600 group-hover:bg-green-500 group-hover:text-white transition-colors">
                <Truck size={24} />
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-900">Tài xế</div>
                <div className="text-xs text-gray-500 mt-1">Nhận và giao đơn hàng</div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage;
