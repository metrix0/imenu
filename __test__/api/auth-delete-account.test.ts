import { POST } from "@/app/api/auth/delete-account/route";

const mockGetUser = jest.fn();
const mockDeleteUser = jest.fn();
const mockCreateClient = jest.fn(() => ({
  auth: {
    getUser: mockGetUser,
    admin: {
      deleteUser: mockDeleteUser,
    },
  },
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("POST /api/auth/delete-account", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockReset();
    mockDeleteUser.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
  });

  it("returns success when the user is deleted", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockDeleteUser.mockResolvedValue({ error: null });

    const request = new Request(
      "http://localhost/api/auth/delete-account",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: "valid-token" }),
      }
    );

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ success: true });
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    expect(mockGetUser).toHaveBeenCalledWith("valid-token");
    expect(mockDeleteUser).toHaveBeenCalledWith("user-123");
  });

  it("returns 401 when access token is missing", async () => {
    const request = new Request(
      "http://localhost/api/auth/delete-account",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ error: "Unauthorized" });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("returns 401 when Supabase cannot find the user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "User not found" },
    });

    const request = new Request(
      "http://localhost/api/auth/delete-account",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: "invalid-token" }),
      }
    );

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ error: "Unauthorized" });
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("returns 500 when deleting the user fails", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockDeleteUser.mockResolvedValue({
      error: { message: "Delete failed" },
    });

    const request = new Request(
      "http://localhost/api/auth/delete-account",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: "valid-token" }),
      }
    );

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: "Delete failed" });
  });
});
