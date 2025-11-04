const mockGetUser = jest.fn();
const mockDeleteUser = jest.fn();
let mockCreateClient: jest.Mock;

jest.mock("@supabase/supabase-js", () => {
  mockCreateClient = jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
      admin: {
        deleteUser: mockDeleteUser,
      },
    },
  }));

  return {
    createClient: mockCreateClient,
  };
});

import { POST } from "@/app/api/auth/delete-account/route";

const defaultEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

describe("POST /api/auth/delete-account", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockReset();
    mockDeleteUser.mockReset();

    process.env.NEXT_PUBLIC_SUPABASE_URL = defaultEnv.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = defaultEnv.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("returns 401 when access token is missing", async () => {
    const req = new Request("http://localhost/api/auth/delete-account", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ error: "Unauthorized" });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("returns 401 when user cannot be retrieved", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "User not found" },
    });

    const req = new Request("http://localhost/api/auth/delete-account", {
      method: "POST",
      body: JSON.stringify({ access_token: "access-token" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(mockCreateClient).toHaveBeenCalledWith(
      defaultEnv.NEXT_PUBLIC_SUPABASE_URL,
      defaultEnv.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    expect(res.status).toBe(401);
    expect(json).toEqual({ error: "Unauthorized" });
  });

  it("returns 500 when deleting the user fails", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockDeleteUser.mockResolvedValueOnce({
      error: { message: "Delete failed" },
    });

    const req = new Request("http://localhost/api/auth/delete-account", {
      method: "POST",
      body: JSON.stringify({ access_token: "access-token" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(mockCreateClient).toHaveBeenCalledWith(
      defaultEnv.NEXT_PUBLIC_SUPABASE_URL,
      defaultEnv.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    expect(mockGetUser).toHaveBeenCalledWith("access-token");
    expect(mockDeleteUser).toHaveBeenCalledWith("user-123");
    expect(res.status).toBe(500);
    expect(json).toEqual({ error: "Delete failed" });
  });

  it("deletes the user successfully", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockDeleteUser.mockResolvedValueOnce({ error: null });

    const req = new Request("http://localhost/api/auth/delete-account", {
      method: "POST",
      body: JSON.stringify({ access_token: "access-token" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(mockCreateClient).toHaveBeenCalledWith(
      defaultEnv.NEXT_PUBLIC_SUPABASE_URL,
      defaultEnv.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    expect(mockGetUser).toHaveBeenCalledWith("access-token");
    expect(mockDeleteUser).toHaveBeenCalledWith("user-123");
    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true });
  });
});
