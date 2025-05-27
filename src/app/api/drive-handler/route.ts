// src/app/api/drive-handler/route.ts
import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";

async function getAuthenticatedClient(
  accessToken: string
): Promise<OAuth2Client> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return oauth2Client;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid token" },
        { status: 401 }
      );
    }
    const accessToken = authHeader.split(" ")[1];

    const body = await request.json();
    const { action } = body;

    const oauth2Client = await getAuthenticatedClient(accessToken);
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    if (action === "findOrCreateFolder") {
      const { folderName, parentFolderId = "root" } = body;
      if (!folderName) {
        return NextResponse.json(
          { error: "Missing folderName" },
          { status: 400 }
        );
      }

      try {
        const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(
          /'/g,
          "\\'"
        )}' and trashed=false and '${
          parentFolderId === "root" ? "root" : parentFolderId
        }' in parents`;
        const listResponse = await drive.files.list({
          q,
          fields: "files(id, name)",
        });

        if (listResponse.data.files && listResponse.data.files.length > 0) {
          return NextResponse.json({ driveId: listResponse.data.files[0].id! });
        } else {
          const fileMetadata = {
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: parentFolderId === "root" ? undefined : [parentFolderId],
          };
          const createResponse = await drive.files.create({
            requestBody: fileMetadata,
            fields: "id",
          });
          return NextResponse.json({ driveId: createResponse.data.id! });
        }
      } catch (error: any) {
        console.error(
          "Error in findOrCreateFolder action:",
          error.response?.data || error.message
        );
        return NextResponse.json(
          {
            error: `Drive API error: ${
              error.response?.data?.error?.message || error.message
            }`,
          },
          { status: 500 }
        );
      }
    } else if (action === "uploadFile") {
      const {
        fileName,
        fileContentBase64,
        parentFolderId,
        mimeType = "application/pdf",
      } = body;
      if (!fileName || !fileContentBase64 || !parentFolderId) {
        return NextResponse.json(
          { error: "Missing fileName, fileContentBase64, or parentFolderId" },
          { status: 400 }
        );
      }

      try {
        const fileMetadata = {
          name: fileName,
          parents: [parentFolderId],
        };
        const buffer = Buffer.from(fileContentBase64, "base64");
        const media = {
          mimeType: mimeType,
          body: Readable.from(buffer), // Convert Buffer to ReadableStream
        };
        const uploadResponse = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: "id",
        });
        return NextResponse.json({ driveFileId: uploadResponse.data.id! });
      } catch (error: any) {
        console.error(
          "Error in uploadFile action:",
          error.response?.data || error.message
        );
        return NextResponse.json(
          {
            error: `Drive API error: ${
              error.response?.data?.error?.message || error.message
            }`,
          },
          { status: 500 }
        );
      }
    } else if (action === "listSubFolders") {
      const { parentFolderId = "root" } = body;
      if (!parentFolderId) {
        return NextResponse.json(
          { error: "Missing parentFolderId" },
          { status: 400 }
        );
      }
      try {
        const q = `mimeType='application/vnd.google-apps.folder' and trashed=false and '${parentFolderId}' in parents`;
        const listResponse = await drive.files.list({
          q,
          fields: "files(id, name)",
          pageSize: 1000, // Adjust as needed, or implement pagination if expecting more
        });

        const subFolders =
          listResponse.data.files?.map((file) => ({
            id: file.id!,
            name: file.name!,
          })) || [];

        return NextResponse.json({ subFolders });
      } catch (error: any) {
        console.error(
          "Error in listSubFolders action:",
          error.response?.data || error.message
        );
        return NextResponse.json(
          {
            error: `Drive API error: ${
              error.response?.data?.error?.message || error.message
            }`,
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("API Error in drive-handler:", error);
    return NextResponse.json(
      { error: `Server error: ${error.message}` },
      { status: 500 }
    );
  }
}
