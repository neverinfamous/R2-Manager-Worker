import type { Env, CloudflareApiResponse } from "../types";
import { CF_API } from "../types";
import { getCloudflareHeaders } from "../utils/helpers";
import { logAuditEvent } from "./audit";
import { logInfo, logError } from "../utils/error-logger";
import {
  triggerWebhooks,
  createFolderCreatePayload,
  createFolderDeletePayload,
} from "../utils/webhooks";
import { createErrorResponse } from "../utils/error-response";

interface R2ObjectInfo {
  key: string;
  size: number;
  uploaded?: string;
}

interface CreateFolderBody {
  folderName?: string;
}

interface RenameFolderBody {
  oldPath?: string;
  newPath?: string;
}

interface TransferBody {
  destinationBucket: string;
  destinationPath?: string;
}

export async function handleFolderRoutes(
  request: Request,
  env: Env,
  url: URL,
  corsHeaders: HeadersInit,
  isLocalDev: boolean,
  userEmail: string,
): Promise<Response> {
  logInfo("Handling folder operation", {
    module: "folders",
    operation: "handle_request",
  });
  const parts = url.pathname.split("/");
  const bucketName = parts[3];
  const db = env.METADATA;

  const cfHeaders = getCloudflareHeaders(env);

  // Create folder
  if (request.method === "POST" && parts[4] === "create") {
    try {
      const body = (await request.json()) as CreateFolderBody;
      const folderName = body.folderName?.trim();

      if (folderName === undefined || folderName === "") {
        return createErrorResponse("Folder name is required", corsHeaders, 400);
      }

      // Validate folder name
      const validFolderPattern = /^[a-zA-Z0-9-_/]+$/;
      if (!validFolderPattern.test(folderName)) {
        return createErrorResponse(
          "Invalid folder name. Use only letters, numbers, hyphens, underscores, and forward slashes",
          corsHeaders,
          400,
        );
      }

      // Ensure folder path ends with /
      const folderPath = folderName.endsWith("/")
        ? folderName
        : folderName + "/";

      // Mock response for local development
      if (isLocalDev) {
        logInfo("Simulating folder creation for local development", {
          module: "folders",
          operation: "create_folder",
          metadata: { folderPath },
        });
        return new Response(
          JSON.stringify({
            success: true,
            folderPath,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      }

      // Create a placeholder .keep file
      const keepFilePath = folderPath + ".keep";
      const putUrl =
        CF_API +
        "/accounts/" +
        env.ACCOUNT_ID +
        "/r2/buckets/" +
        bucketName +
        "/objects/" +
        encodeURIComponent(keepFilePath);

      const response = await fetch(putUrl, {
        method: "PUT",
        headers: {
          ...cfHeaders,
          "Content-Type": "text/plain",
        },
        body: "",
      });

      if (!response.ok) {
        throw new Error("Failed to create folder: " + String(response.status));
      }

      logInfo("Created folder", {
        module: "folders",
        operation: "create_folder",
        metadata: { folderPath },
      });

      // Log audit event for folder creation
      if (db) {
        await logAuditEvent(
          env,
          {
            operationType: "folder_create",
            bucketName: bucketName ?? undefined,
            objectKey: folderPath,
            userEmail,
            status: "success",
          },
          isLocalDev,
        );
      }

      // Trigger webhook for folder creation
      void triggerWebhooks(
        env,
        "folder_create",
        createFolderCreatePayload(bucketName ?? "", folderPath, userEmail),
        isLocalDev,
      );

      return new Response(JSON.stringify({ success: true, folderPath }), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } catch (err) {
      await logError(
        env,
        err instanceof Error ? err : String(err),
        { module: "folders", operation: "create_folder" },
        isLocalDev,
      );

      // Log failed folder creation
      if (db) {
        await logAuditEvent(
          env,
          {
            operationType: "folder_create",
            bucketName: bucketName ?? undefined,
            userEmail,
            status: "failed",
            metadata: { error: String(err) },
          },
          isLocalDev,
        );
      }

      return createErrorResponse("Failed to create folder", corsHeaders, 500);
    }
  }

  // Rename folder
  if (request.method === "PATCH" && parts[4] === "rename") {
    try {
      const body = (await request.json()) as RenameFolderBody;
      const oldPath = body.oldPath?.trim();
      const newPath = body.newPath?.trim();

      if (
        oldPath === undefined ||
        oldPath === "" ||
        newPath === undefined ||
        newPath === ""
      ) {
        return createErrorResponse(
          "Both old and new paths are required",
          corsHeaders,
          400,
        );
      }

      // Ensure paths end with /
      const oldFolderPath = oldPath.endsWith("/") ? oldPath : oldPath + "/";
      const newFolderPath = newPath.endsWith("/") ? newPath : newPath + "/";

      logInfo("Renaming folder", {
        module: "folders",
        operation: "rename_folder",
        metadata: { oldFolderPath, newFolderPath },
      });

      // List all objects with the old prefix
      let cursor: string | undefined;
      let totalCopied = 0;
      let totalFailed = 0;
      let hasMore = true;

      while (hasMore) {
        const listUrl = new URL(
          CF_API +
            "/accounts/" +
            env.ACCOUNT_ID +
            "/r2/buckets/" +
            bucketName +
            "/objects",
        );
        listUrl.searchParams.set("prefix", oldFolderPath);
        listUrl.searchParams.set("per_page", "100");
        if (cursor !== undefined) {
          listUrl.searchParams.set("cursor", cursor);
        }

        const listResponse = await fetch(listUrl.toString(), {
          headers: cfHeaders,
        });
        if (!listResponse.ok) {
          throw new Error(
            "Failed to list objects: " + String(listResponse.status),
          );
        }

        const listData = (await listResponse.json()) as CloudflareApiResponse<
          R2ObjectInfo[]
        >;
        const objects: R2ObjectInfo[] = Array.isArray(listData.result)
          ? listData.result
          : [];

        if (objects.length === 0) {
          break;
        }

        // Copy each object to new location
        for (const obj of objects) {
          try {
            const newKey = obj.key.replace(oldFolderPath, newFolderPath);

            // Get the object
            const getUrl =
              CF_API +
              "/accounts/" +
              env.ACCOUNT_ID +
              "/r2/buckets/" +
              bucketName +
              "/objects/" +
              encodeURIComponent(obj.key);
            const getResponse = await fetch(getUrl, { headers: cfHeaders });

            if (!getResponse.ok) {
              totalFailed++;
              continue;
            }

            const fileBuffer = await getResponse.arrayBuffer();
            const contentType =
              getResponse.headers.get("Content-Type") ??
              "application/octet-stream";

            // Put to new location
            const putUrl =
              CF_API +
              "/accounts/" +
              env.ACCOUNT_ID +
              "/r2/buckets/" +
              bucketName +
              "/objects/" +
              encodeURIComponent(newKey);
            const putResponse = await fetch(putUrl, {
              method: "PUT",
              headers: {
                ...cfHeaders,
                "Content-Type": contentType,
              },
              body: fileBuffer,
            });

            if (putResponse.ok) {
              totalCopied++;
            } else {
              totalFailed++;
            }
          } catch {
            totalFailed++;
          }
        }

        cursor = listData.result_info?.cursor as string | undefined;
        hasMore = cursor !== undefined && objects.length > 0;

        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      // Delete old folder objects
      cursor = undefined;
      hasMore = true;

      while (hasMore) {
        const listUrl = new URL(
          CF_API +
            "/accounts/" +
            env.ACCOUNT_ID +
            "/r2/buckets/" +
            bucketName +
            "/objects",
        );
        listUrl.searchParams.set("prefix", oldFolderPath);
        listUrl.searchParams.set("per_page", "100");
        if (cursor !== undefined) {
          listUrl.searchParams.set("cursor", cursor);
        }

        const listResponse = await fetch(listUrl.toString(), {
          headers: cfHeaders,
        });
        if (!listResponse.ok) break;

        const listData = (await listResponse.json()) as CloudflareApiResponse<
          R2ObjectInfo[]
        >;
        const objects: R2ObjectInfo[] = Array.isArray(listData.result)
          ? listData.result
          : [];

        if (objects.length === 0) break;

        for (const obj of objects) {
          try {
            const deleteUrl =
              CF_API +
              "/accounts/" +
              env.ACCOUNT_ID +
              "/r2/buckets/" +
              bucketName +
              "/objects/" +
              encodeURIComponent(obj.key);
            await fetch(deleteUrl, { method: "DELETE", headers: cfHeaders });
          } catch {
            // Continue on delete failure
          }
        }

        cursor = listData.result_info?.cursor as string | undefined;
        hasMore = cursor !== undefined && objects.length > 0;

        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      logInfo("Renamed folder", {
        module: "folders",
        operation: "rename_folder",
        metadata: { totalCopied, totalFailed },
      });

      // Log audit event for folder rename
      if (db) {
        await logAuditEvent(
          env,
          {
            operationType: "folder_rename",
            bucketName: bucketName ?? undefined,
            objectKey: oldFolderPath,
            userEmail,
            status: "success",
            destinationBucket: bucketName ?? undefined,
            destinationKey: newFolderPath,
            metadata: { filesCopied: totalCopied, filesFailed: totalFailed },
          },
          isLocalDev,
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          copied: totalCopied,
          failed: totalFailed,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    } catch (err) {
      await logError(
        env,
        err instanceof Error ? err : String(err),
        { module: "folders", operation: "rename_folder" },
        isLocalDev,
      );

      // Log failed folder rename
      if (db) {
        await logAuditEvent(
          env,
          {
            operationType: "folder_rename",
            bucketName: bucketName ?? undefined,
            userEmail,
            status: "failed",
            metadata: { error: String(err) },
          },
          isLocalDev,
        );
      }

      return createErrorResponse("Failed to rename folder", corsHeaders, 500);
    }
  }

  // Copy folder
  if (request.method === "POST" && parts[parts.length - 1] === "copy") {
    try {
      const folderPath = decodeURIComponent(parts.slice(4, -1).join("/"));
      const body = (await request.json()) as TransferBody;
      const destBucket = body.destinationBucket;
      const destPath = body.destinationPath ?? folderPath;

      if (destBucket === undefined || destBucket === "") {
        return createErrorResponse(
          "Destination bucket is required",
          corsHeaders,
          400,
        );
      }

      // Ensure paths end with /
      const sourceFolderPath = folderPath.endsWith("/")
        ? folderPath
        : folderPath + "/";
      const destFolderPath = destPath.endsWith("/") ? destPath : destPath + "/";

      logInfo("Copying folder", {
        module: "folders",
        operation: "copy_folder",
        metadata: {
          source: bucketName + "/" + sourceFolderPath,
          dest: destBucket + "/" + destFolderPath,
        },
      });

      let cursor: string | undefined;
      let totalCopied = 0;
      let totalFailed = 0;
      let hasMore = true;

      while (hasMore) {
        const listUrl = new URL(
          CF_API +
            "/accounts/" +
            env.ACCOUNT_ID +
            "/r2/buckets/" +
            bucketName +
            "/objects",
        );
        listUrl.searchParams.set("prefix", sourceFolderPath);
        listUrl.searchParams.set("per_page", "100");
        if (cursor !== undefined) {
          listUrl.searchParams.set("cursor", cursor);
        }

        const listResponse = await fetch(listUrl.toString(), {
          headers: cfHeaders,
        });
        if (!listResponse.ok) {
          throw new Error(
            "Failed to list objects: " + String(listResponse.status),
          );
        }

        const listData = (await listResponse.json()) as CloudflareApiResponse<
          R2ObjectInfo[]
        >;
        const objects: R2ObjectInfo[] = Array.isArray(listData.result)
          ? listData.result
          : [];

        if (objects.length === 0) {
          break;
        }

        for (const obj of objects) {
          try {
            const relativePath = obj.key.substring(sourceFolderPath.length);
            const destKey = destFolderPath + relativePath;

            // Get the object
            const getUrl =
              CF_API +
              "/accounts/" +
              env.ACCOUNT_ID +
              "/r2/buckets/" +
              bucketName +
              "/objects/" +
              encodeURIComponent(obj.key);
            const getResponse = await fetch(getUrl, { headers: cfHeaders });

            if (!getResponse.ok) {
              totalFailed++;
              continue;
            }

            const fileBuffer = await getResponse.arrayBuffer();
            const contentType =
              getResponse.headers.get("Content-Type") ??
              "application/octet-stream";

            // Put to destination
            const putUrl =
              CF_API +
              "/accounts/" +
              env.ACCOUNT_ID +
              "/r2/buckets/" +
              destBucket +
              "/objects/" +
              encodeURIComponent(destKey);
            const putResponse = await fetch(putUrl, {
              method: "PUT",
              headers: {
                ...cfHeaders,
                "Content-Type": contentType,
              },
              body: fileBuffer,
            });

            if (putResponse.ok) {
              totalCopied++;
            } else {
              totalFailed++;
            }
          } catch {
            totalFailed++;
          }
        }

        cursor = listData.result_info?.cursor as string | undefined;
        hasMore = cursor !== undefined && objects.length > 0;

        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      logInfo("Copied folder", {
        module: "folders",
        operation: "copy_folder",
        metadata: { totalCopied, totalFailed },
      });

      // Log audit event for folder copy
      if (db) {
        await logAuditEvent(
          env,
          {
            operationType: "folder_copy",
            bucketName: bucketName ?? undefined,
            objectKey: sourceFolderPath,
            userEmail,
            status: "success",
            destinationBucket: destBucket,
            destinationKey: destFolderPath,
            metadata: { filesCopied: totalCopied, filesFailed: totalFailed },
          },
          isLocalDev,
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          copied: totalCopied,
          failed: totalFailed,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    } catch (err) {
      await logError(
        env,
        err instanceof Error ? err : String(err),
        { module: "folders", operation: "copy_folder" },
        isLocalDev,
      );

      // Log failed folder copy
      if (db) {
        const failedFolderPath = decodeURIComponent(
          parts.slice(4, -1).join("/"),
        );
        await logAuditEvent(
          env,
          {
            operationType: "folder_copy",
            bucketName: bucketName ?? undefined,
            objectKey: failedFolderPath,
            userEmail,
            status: "failed",
            metadata: { error: String(err) },
          },
          isLocalDev,
        );
      }

      return createErrorResponse("Failed to copy folder", corsHeaders, 500);
    }
  }

  // Move folder
  if (request.method === "POST" && parts[parts.length - 1] === "move") {
    try {
      const folderPath = decodeURIComponent(parts.slice(4, -1).join("/"));
      const body = (await request.json()) as TransferBody;
      const destBucket = body.destinationBucket;
      const destPath = body.destinationPath ?? folderPath;

      if (destBucket === undefined || destBucket === "") {
        return createErrorResponse(
          "Destination bucket is required",
          corsHeaders,
          400,
        );
      }

      // Ensure paths end with /
      const sourceFolderPath = folderPath.endsWith("/")
        ? folderPath
        : folderPath + "/";
      const destFolderPath = destPath.endsWith("/") ? destPath : destPath + "/";

      logInfo("Moving folder", {
        module: "folders",
        operation: "move_folder",
        metadata: {
          source: bucketName + "/" + sourceFolderPath,
          dest: destBucket + "/" + destFolderPath,
        },
      });

      // First copy all files
      let cursor: string | undefined;
      let totalMoved = 0;
      let totalFailed = 0;
      let hasMore = true;

      while (hasMore) {
        const listUrl = new URL(
          CF_API +
            "/accounts/" +
            env.ACCOUNT_ID +
            "/r2/buckets/" +
            bucketName +
            "/objects",
        );
        listUrl.searchParams.set("prefix", sourceFolderPath);
        listUrl.searchParams.set("per_page", "100");
        if (cursor !== undefined) {
          listUrl.searchParams.set("cursor", cursor);
        }

        const listResponse = await fetch(listUrl.toString(), {
          headers: cfHeaders,
        });
        if (!listResponse.ok) {
          throw new Error(
            "Failed to list objects: " + String(listResponse.status),
          );
        }

        const listData = (await listResponse.json()) as CloudflareApiResponse<
          R2ObjectInfo[]
        >;
        const objects: R2ObjectInfo[] = Array.isArray(listData.result)
          ? listData.result
          : [];

        if (objects.length === 0) {
          break;
        }

        for (const obj of objects) {
          try {
            const relativePath = obj.key.substring(sourceFolderPath.length);
            const destKey = destFolderPath + relativePath;

            // Get the object
            const getUrl =
              CF_API +
              "/accounts/" +
              env.ACCOUNT_ID +
              "/r2/buckets/" +
              bucketName +
              "/objects/" +
              encodeURIComponent(obj.key);
            const getResponse = await fetch(getUrl, { headers: cfHeaders });

            if (!getResponse.ok) {
              totalFailed++;
              continue;
            }

            const fileBuffer = await getResponse.arrayBuffer();
            const contentType =
              getResponse.headers.get("Content-Type") ??
              "application/octet-stream";

            // Put to destination
            const putUrl =
              CF_API +
              "/accounts/" +
              env.ACCOUNT_ID +
              "/r2/buckets/" +
              destBucket +
              "/objects/" +
              encodeURIComponent(destKey);
            const putResponse = await fetch(putUrl, {
              method: "PUT",
              headers: {
                ...cfHeaders,
                "Content-Type": contentType,
              },
              body: fileBuffer,
            });

            if (putResponse.ok) {
              totalMoved++;
            } else {
              totalFailed++;
            }
          } catch {
            totalFailed++;
          }
        }

        cursor = listData.result_info?.cursor as string | undefined;
        hasMore = cursor !== undefined && objects.length > 0;

        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      // Delete source folder objects
      cursor = undefined;
      hasMore = true;

      while (hasMore) {
        const listUrl = new URL(
          CF_API +
            "/accounts/" +
            env.ACCOUNT_ID +
            "/r2/buckets/" +
            bucketName +
            "/objects",
        );
        listUrl.searchParams.set("prefix", sourceFolderPath);
        listUrl.searchParams.set("per_page", "100");
        if (cursor !== undefined) {
          listUrl.searchParams.set("cursor", cursor);
        }

        const listResponse = await fetch(listUrl.toString(), {
          headers: cfHeaders,
        });
        if (!listResponse.ok) break;

        const listData = (await listResponse.json()) as CloudflareApiResponse<
          R2ObjectInfo[]
        >;
        const objects: R2ObjectInfo[] = Array.isArray(listData.result)
          ? listData.result
          : [];

        if (objects.length === 0) break;

        for (const obj of objects) {
          try {
            const deleteUrl =
              CF_API +
              "/accounts/" +
              env.ACCOUNT_ID +
              "/r2/buckets/" +
              bucketName +
              "/objects/" +
              encodeURIComponent(obj.key);
            await fetch(deleteUrl, { method: "DELETE", headers: cfHeaders });
          } catch {
            // Continue on delete failure
          }
        }

        cursor = listData.result_info?.cursor as string | undefined;
        hasMore = cursor !== undefined && objects.length > 0;

        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      logInfo("Moved folder", {
        module: "folders",
        operation: "move_folder",
        metadata: { totalMoved, totalFailed },
      });

      // Log audit event for folder move
      if (db) {
        await logAuditEvent(
          env,
          {
            operationType: "folder_move",
            bucketName: bucketName ?? undefined,
            objectKey: sourceFolderPath,
            userEmail,
            status: "success",
            destinationBucket: destBucket,
            destinationKey: destFolderPath,
            metadata: { filesMoved: totalMoved, filesFailed: totalFailed },
          },
          isLocalDev,
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          moved: totalMoved,
          failed: totalFailed,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    } catch (err) {
      await logError(
        env,
        err instanceof Error ? err : String(err),
        { module: "folders", operation: "move_folder" },
        isLocalDev,
      );

      // Log failed folder move
      if (db) {
        const failedFolderPath = decodeURIComponent(
          parts.slice(4, -1).join("/"),
        );
        await logAuditEvent(
          env,
          {
            operationType: "folder_move",
            bucketName: bucketName ?? undefined,
            objectKey: failedFolderPath,
            userEmail,
            status: "failed",
            metadata: { error: String(err) },
          },
          isLocalDev,
        );
      }

      return createErrorResponse("Failed to move folder", corsHeaders, 500);
    }
  }

  // Delete folder
  if (request.method === "DELETE" && parts.length >= 5) {
    try {
      const folderPath = decodeURIComponent(parts.slice(4).join("/"));
      const force = url.searchParams.get("force") === "true";

      // Ensure path ends with /
      const folderPathWithSlash = folderPath.endsWith("/")
        ? folderPath
        : folderPath + "/";

      logInfo("Deleting folder", {
        module: "folders",
        operation: "delete_folder",
        metadata: { folderPath: folderPathWithSlash, force },
      });

      // List objects in folder
      const listUrl = new URL(
        CF_API +
          "/accounts/" +
          env.ACCOUNT_ID +
          "/r2/buckets/" +
          bucketName +
          "/objects",
      );
      listUrl.searchParams.set("prefix", folderPathWithSlash);
      listUrl.searchParams.set("per_page", "100");

      const listResponse = await fetch(listUrl.toString(), {
        headers: cfHeaders,
      });
      if (!listResponse.ok) {
        throw new Error(
          "Failed to list objects: " + String(listResponse.status),
        );
      }

      const listData = (await listResponse.json()) as CloudflareApiResponse<
        R2ObjectInfo[]
      >;
      const countObjects: R2ObjectInfo[] = Array.isArray(listData.result)
        ? listData.result
        : [];
      const fileCount = countObjects.length;

      // If not force mode, return count for confirmation
      if (!force && fileCount > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            fileCount,
            message: "Folder contains files. Use force=true to delete.",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      }

      // Delete all objects
      let cursor: string | undefined;
      let totalDeleted = 0;
      let hasMore = true;

      while (hasMore) {
        const deleteListUrl = new URL(
          CF_API +
            "/accounts/" +
            env.ACCOUNT_ID +
            "/r2/buckets/" +
            bucketName +
            "/objects",
        );
        deleteListUrl.searchParams.set("prefix", folderPathWithSlash);
        deleteListUrl.searchParams.set("per_page", "100");
        if (cursor !== undefined) {
          deleteListUrl.searchParams.set("cursor", cursor);
        }

        const deleteListResponse = await fetch(deleteListUrl.toString(), {
          headers: cfHeaders,
        });
        if (!deleteListResponse.ok) break;

        const deleteListData =
          (await deleteListResponse.json()) as CloudflareApiResponse<
            R2ObjectInfo[]
          >;
        const deleteObjects: R2ObjectInfo[] = Array.isArray(
          deleteListData.result,
        )
          ? deleteListData.result
          : [];

        if (deleteObjects.length === 0) break;

        for (const obj of deleteObjects) {
          try {
            const deleteUrl =
              CF_API +
              "/accounts/" +
              env.ACCOUNT_ID +
              "/r2/buckets/" +
              bucketName +
              "/objects/" +
              encodeURIComponent(obj.key);
            const deleteResponse = await fetch(deleteUrl, {
              method: "DELETE",
              headers: cfHeaders,
            });

            if (deleteResponse.ok) {
              totalDeleted++;
            }
          } catch {
            // Continue on delete failure
          }
        }

        cursor = deleteListData.result_info?.cursor as string | undefined;
        hasMore = cursor !== undefined && deleteObjects.length > 0;

        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      logInfo("Deleted folder", {
        module: "folders",
        operation: "delete_folder",
        metadata: { totalDeleted },
      });

      // Log audit event for folder delete
      if (db) {
        await logAuditEvent(
          env,
          {
            operationType: "folder_delete",
            bucketName: bucketName ?? undefined,
            objectKey: folderPathWithSlash,
            userEmail,
            status: "success",
            metadata: { filesDeleted: totalDeleted, force },
          },
          isLocalDev,
        );
      }

      // Trigger webhook for folder deletion
      void triggerWebhooks(
        env,
        "folder_delete",
        createFolderDeletePayload(
          bucketName ?? "",
          folderPathWithSlash,
          totalDeleted,
          userEmail,
        ),
        isLocalDev,
      );

      return new Response(
        JSON.stringify({
          success: true,
          deleted: totalDeleted,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    } catch (err) {
      await logError(
        env,
        err instanceof Error ? err : String(err),
        { module: "folders", operation: "delete_folder" },
        isLocalDev,
      );

      // Log failed folder delete
      if (db) {
        const failedFolderPath = decodeURIComponent(parts.slice(4).join("/"));
        await logAuditEvent(
          env,
          {
            operationType: "folder_delete",
            bucketName: bucketName ?? undefined,
            objectKey: failedFolderPath,
            userEmail,
            status: "failed",
            metadata: { error: String(err) },
          },
          isLocalDev,
        );
      }

      return createErrorResponse("Failed to delete folder", corsHeaders, 500);
    }
  }

  return new Response("Not Found", {
    status: 404,
    headers: corsHeaders,
  });
}
